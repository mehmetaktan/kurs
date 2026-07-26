//! Tahsilat makbuzu: veri projeksiyonu dışında saf PDF ve yazıyla tutar üretimi.
//!
//! Font depoya ve PDF'e gömülüdür. Böylece Windows makinesinde kurulu fontlara
//! güvenmeden `ğ ş İ ı` karakterleri doğru basılır (CLAUDE.md > Windows).

use base64::{engine::general_purpose::STANDARD, Engine as _};
use printpdf::{
    Mm, Op, ParsedFont, PdfDocument, PdfFontHandle, PdfPage, PdfSaveOptions, Point, Pt, TextItem,
};
use serde::Serialize;
use std::sync::OnceLock;

use crate::brand::Institution;
use crate::error::{AppError, AppResult};

const FONT_BASE64: &str = include_str!("../assets/NotoSans-Receipt.ttf.b64");

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptData {
    pub payment_id: i64,
    pub receipt_no: String,
    pub paid_on: String,
    pub amount: i64,
    pub method: String,
    pub note: Option<String>,
    pub student_name: String,
    pub guardian_name: Option<String>,
    pub cancelled: bool,
}

/// Kuruş cinsinden tutarı Türkçe yazıyla verir.
pub fn amount_in_words(kurus: i64) -> String {
    let absolute = kurus.unsigned_abs();
    let lira = absolute / 100;
    let cents = absolute % 100;
    let mut words = if kurus < 0 {
        format!("eksi {} TL", integer_in_words(lira))
    } else {
        format!("{} TL", integer_in_words(lira))
    };
    if cents > 0 {
        words.push_str(&format!(" {} kuruş", integer_in_words(cents)));
    }
    capitalize_first(&words)
}

fn integer_in_words(mut value: u64) -> String {
    if value == 0 {
        return "sıfır".to_string();
    }
    const SCALES: [&str; 7] = [
        "",
        "bin",
        "milyon",
        "milyar",
        "trilyon",
        "katrilyon",
        "kentilyon",
    ];
    let mut groups = Vec::new();
    let mut scale = 0_usize;
    while value > 0 {
        let group = value % 1_000;
        if group > 0 {
            let body = if scale == 1 && group == 1 {
                String::new()
            } else {
                under_thousand(group)
            };
            groups.push(match (body.is_empty(), SCALES[scale].is_empty()) {
                (true, false) => SCALES[scale].to_string(),
                (false, true) => body,
                (false, false) => format!("{body} {}", SCALES[scale]),
                (true, true) => String::new(),
            });
        }
        value /= 1_000;
        scale += 1;
    }
    groups.reverse();
    groups.join(" ")
}

fn under_thousand(value: u64) -> String {
    const ONES: [&str; 10] = [
        "", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz",
    ];
    const TENS: [&str; 10] = [
        "", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan",
    ];
    let hundreds = value / 100;
    let tens = (value % 100) / 10;
    let ones = value % 10;
    let mut parts = Vec::new();
    if hundreds > 0 {
        if hundreds > 1 {
            parts.push(ONES[hundreds as usize]);
        }
        parts.push("yüz");
    }
    if tens > 0 {
        parts.push(TENS[tens as usize]);
    }
    if ones > 0 {
        parts.push(ONES[ones as usize]);
    }
    parts.join(" ")
}

fn capitalize_first(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

fn font_bytes() -> &'static [u8] {
    static FONT: OnceLock<Vec<u8>> = OnceLock::new();
    FONT.get_or_init(|| {
        let compact: String = FONT_BASE64
            .chars()
            .filter(|ch| !ch.is_whitespace())
            .collect();
        STANDARD
            .decode(compact)
            .expect("gömülü Noto Sans makbuz fontu base64 olarak bozuk")
    })
}

fn push_text(
    ops: &mut Vec<Op>,
    font: &printpdf::FontId,
    text: impl Into<String>,
    x: f32,
    y: f32,
    size: f32,
) {
    ops.extend([
        Op::StartTextSection,
        Op::SetTextCursor {
            pos: Point::new(Mm(x), Mm(y)),
        },
        Op::SetFont {
            font: PdfFontHandle::External(font.clone()),
            size: Pt(size),
        },
        Op::ShowText {
            items: vec![TextItem::Text(text.into())],
        },
        Op::EndTextSection,
    ]);
}

fn wrap_words(value: &str, max_chars: usize) -> Vec<String> {
    let mut lines = vec![String::new()];
    for word in value.split_whitespace() {
        let current = lines.last_mut().expect("ilk satır var");
        let next_len =
            current.chars().count() + usize::from(!current.is_empty()) + word.chars().count();
        if !current.is_empty() && next_len > max_chars {
            lines.push(word.to_string());
        } else {
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(word);
        }
    }
    lines
}

fn push_wrapped_text(
    ops: &mut Vec<Op>,
    font: &printpdf::FontId,
    text: &str,
    x: f32,
    y: f32,
    size: f32,
    max_chars: usize,
) {
    for (index, line) in wrap_words(text, max_chars).into_iter().enumerate() {
        push_text(ops, font, line, x, y - index as f32 * 6.0, size);
    }
}

fn payment_method(method: &str) -> &'static str {
    match method {
        "cash" => "Nakit",
        "card" => "Kart",
        "transfer" => "Havale",
        _ => "Belirtilmedi",
    }
}

fn display_date(day: &str) -> String {
    let mut parts = day.split('-');
    match (parts.next(), parts.next(), parts.next(), parts.next()) {
        (Some(year), Some(month), Some(day), None) => format!("{day}.{month}.{year}"),
        _ => day.to_string(),
    }
}

/// A5 boyutunda, gömülü Türkçe fontlu makbuz PDF'i üretir.
pub fn build_pdf(data: &ReceiptData, institution: &Institution) -> AppResult<Vec<u8>> {
    let font = ParsedFont::from_bytes(font_bytes(), 0, &mut Vec::new()).ok_or_else(|| {
        AppError::new(
            "receipt_font",
            "Makbuz yazı tipi yüklenemedi. Programı kapatıp yeniden açın.",
        )
    })?;
    let mut pdf = PdfDocument::new(&format!("Makbuz {}", data.receipt_no));
    pdf.metadata.info.author = "Kurs Takip".to_string();
    let font_id = pdf.add_font(&font);
    let mut ops = Vec::new();

    push_text(
        &mut ops,
        &font_id,
        institution.name.clone(),
        18.0,
        188.0,
        16.0,
    );
    push_text(&mut ops, &font_id, "TAHSİLAT MAKBUZU", 18.0, 178.0, 12.0);
    let mut header_y = 170.0_f32;
    if !institution.receipt.address.trim().is_empty() {
        push_text(
            &mut ops,
            &font_id,
            institution.receipt.address.trim(),
            18.0,
            header_y,
            8.5,
        );
        header_y -= 5.0;
    }
    if !institution.receipt.phone.trim().is_empty() {
        push_text(
            &mut ops,
            &font_id,
            format!("Telefon: {}", institution.receipt.phone.trim()),
            18.0,
            header_y,
            8.5,
        );
    }

    push_text(
        &mut ops,
        &font_id,
        format!("Makbuz No: {}", data.receipt_no),
        18.0,
        157.0,
        10.0,
    );
    push_text(
        &mut ops,
        &font_id,
        format!("Tarih: {}", display_date(&data.paid_on)),
        92.0,
        157.0,
        10.0,
    );
    push_text(
        &mut ops,
        &font_id,
        format!("Öğrenci: {}", data.student_name),
        18.0,
        143.0,
        10.5,
    );
    if let Some(guardian) = data
        .guardian_name
        .as_deref()
        .filter(|name| !name.trim().is_empty())
    {
        push_text(
            &mut ops,
            &font_id,
            format!("Veli: {guardian}"),
            18.0,
            134.0,
            10.5,
        );
    }
    push_text(
        &mut ops,
        &font_id,
        format!("Ödeme yöntemi: {}", payment_method(&data.method)),
        18.0,
        121.0,
        10.5,
    );
    push_text(
        &mut ops,
        &font_id,
        format!("Tutar: {}", crate::money::format_lira(data.amount)),
        18.0,
        105.0,
        15.0,
    );
    push_wrapped_text(
        &mut ops,
        &font_id,
        &format!("Yazıyla: {}", amount_in_words(data.amount)),
        18.0,
        94.0,
        9.5,
        58,
    );
    if let Some(note) = data.note.as_deref().filter(|note| !note.trim().is_empty()) {
        push_wrapped_text(
            &mut ops,
            &font_id,
            &format!("Açıklama: {note}"),
            18.0,
            76.0,
            9.5,
            64,
        );
    }
    push_text(&mut ops, &font_id, "Tahsil eden", 18.0, 43.0, 9.0);
    push_text(&mut ops, &font_id, "İmza", 105.0, 43.0, 9.0);
    if data.cancelled {
        push_text(&mut ops, &font_id, "İPTAL", 51.0, 65.0, 30.0);
    }
    let bytes = pdf
        .with_pages(vec![PdfPage::new(Mm(148.0), Mm(210.0), ops)])
        .save(&PdfSaveOptions::default(), &mut Vec::new());
    if bytes.is_empty() {
        return Err(AppError::new(
            "receipt_pdf",
            "Makbuz PDF'i oluşturulamadı. Programı kapatıp yeniden deneyin.",
        ));
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tutari_turkce_yaziyla_verir() {
        let integers = [
            (0, "sıfır"),
            (1, "bir"),
            (11, "on bir"),
            (100, "yüz"),
            (1_001, "bin bir"),
            (
                1_234_567,
                "bir milyon iki yüz otuz dört bin beş yüz altmış yedi",
            ),
        ];
        for (value, expected) in integers {
            assert_eq!(integer_in_words(value), expected);
        }
        let cases = [
            (0, "Sıfır TL"),
            (100, "Bir TL"),
            (1_100, "On bir TL"),
            (10_000, "Yüz TL"),
            (100_100, "Bin bir TL"),
            (
                123_456_700,
                "Bir milyon iki yüz otuz dört bin beş yüz altmış yedi TL",
            ),
            (
                123_456_750,
                "Bir milyon iki yüz otuz dört bin beş yüz altmış yedi TL elli kuruş",
            ),
        ];
        for (kurus, expected) in cases {
            assert_eq!(amount_in_words(kurus), expected);
        }
    }

    #[test]
    fn negatif_ve_i64_siniri_tasmaz() {
        assert_eq!(amount_in_words(-150), "Eksi bir TL elli kuruş");
        assert!(amount_in_words(i64::MIN).starts_with("Eksi"));
    }

    #[test]
    fn uzun_makbuz_satirini_kelime_sinirinda_boler() {
        assert_eq!(wrap_words("bir iki üç dört", 9), ["bir iki", "üç dört"]);
    }

    #[test]
    fn pdf_turkce_fontu_gomer() {
        let data = ReceiptData {
            payment_id: 1,
            receipt_no: "2026-14".to_string(),
            paid_on: "2026-07-26".to_string(),
            amount: 123_456_750,
            method: "transfer".to_string(),
            note: Some("Özel ders tahsilatı".to_string()),
            student_name: "İpek Şahin".to_string(),
            guardian_name: Some("Çağla Şahin".to_string()),
            cancelled: false,
        };
        let bytes = build_pdf(&data, crate::brand::institution()).unwrap();
        assert!(bytes.starts_with(b"%PDF"));
        assert!(bytes.windows(9).any(|part| part == b"FontFile2"));
    }
}
