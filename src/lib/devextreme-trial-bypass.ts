/**
 * DevExtreme Trial Bypass — multi-vektör (test/RE amaçlı)
 * ========================================================================
 *
 * DevExtreme 26.1.3 builtin lisans mekanizması (RE bulguları):
 *
 *   1) config.licenseKey:
 *      esm/__internal/core/m_config.js → config.licenseKey varsayılan LICENSE_KEY_PLACEHOLDER
 *      (yer tutucu dize — içeriğı önemli değil, const.js LICENSE_KEY_PLACEHOLDER ile birebir).
 *      DevExpress.config({ licenseKey: '...' }) ile set edilir. Placeholder → "no-key" dalı.
 *
 *   2) validateLicense (license_validation.js):
 *      dom_component.js:81 → her DOMComponent ctor'unda bir kez:
 *        license.validateLicense(config().licenseKey)
 *      validateLicense:
 *        - validationPerformed flag (tek seferlik guard)
 *        - parseVersion(fullVersion) → major/minor/patch
 *        - getLicenseCheckParams:
 *            * licenseKey boş/placeholder → { error:'W0019', warningType:'no-key' }
 *            * 'LCX' prefix → 'lcx-used' (W0021)
 *            * 'ewog' prefix → 'old-devextreme-key' (W0021)
 *            * parseLicenseKey (RSA-imzalı LCP token — pkcs1+sha1 doğrulama)
 *              → kind:'corrupted' | 'verified'; verified → maxVersionAllowed kontrol
 *        - error var → displayTrialPanel() + logLicenseWarning(warningType, ...)
 *
 *   3) logLicenseWarning (license_warnings.js):
 *      console.warn(`${code} - DevExtreme: ... ${purchaseLicense}`)
 *      W0019 = "You are using a trial (evaluation) version."
 *      W0020 = "License Key Has Expired."
 *      W0021 = "License Key Verification Has Failed."
 *      + "A devextreme-license generated key has not been specified in the GlobalConfig."
 *
 *   4) trial_panel.client.js — CustomElement:
 *        class DxLicense extends HTMLElement  → custom element 'dx-license'
 *        class DxLicenseTrigger extends HTMLElement → 'dx-license-trigger'
 *      registerCustomComponents: customElements.get yoksa define eder.
 *      renderTrialPanel: body'ye <dx-license-trigger .../> ekler; trigger connectedCallback
 *        içinde <dx-license data-permanent> üretip body.prepend.
 *      DxLicense.connectedCallback: MutationObserver kurar — DOM değişince _reassignComponent
 *        (koruyucu: dışarıdan silmeye karşı içeriği yeniden yazar).
 *      DxLicense.disconnectedCallback: Promise.resolve().then → body'de dx-license yoksa
 *        kendini TEKRAR prepend (DOM'dan silinince geri eklenir — agresif).
 *
 *   5) m_errors.js W0019/W0020/W0021 hata string'leri — errors.log(error) yedek yolu.
 *
 * Bryntum'daki gibi "tek modül yamala" çözümü burada ZOR:
 *   - DevExtreme modüler (ESM) — validateLicense import import ediliyor, prototip
 *     değilIndirildiği için Runtime eklenemiyor. Bu yüzdenConfig / console / customElements /
 *     DOM düzeyindeÖNLENECEK.
 *
 * Strateji (5 vektör — her biri bağımsız yeterli, biri bile kaçsa diğerleri tutar):
 *
 *   V1 — console.warn filtre: DevExtreme W0019/W0020/W0021 lisans uyarı satırlarını yut.
 *        Bryntum bypass'taki console.log filtre deseninin kardeşi.
 *   V2 — config().licenseKey sahte-anhtar:
 *        DevExtreme config() çağrısından önce veya aynı anda "sahte geçerli LCP token"
 *        yerleştir. RSA-imza doğrulama var → sahte anahtar 'corrupted' dalına düşer →
 *        W0021. Bu da log filtre (V1) ile bastırılır. Asıl değer: config'i
 *        LICENSE_KEY_PLACEHOLDER dışına çekerek bazı erkenKolddalifp kontrolü azalt.
 *        İşletmesel "az faydalı" — ama Bryntum deseniyle paralel tutuldu.
 *        ÖNEMLI: dom_component.js:82-85 "validationAlreadyPerformed" kontrolü var: ilk
 *        validateLicense'den SONRA config({licenseKey:''}) sıfırlar — yani config() setter
 *        içine yazsak bile sıfırlar. Bu yüzden V2 yalnız azaltıcı.
 *   V3 — customElements.define önceden tanımla: dx-license ve dx-license-trigger isimli
 *        uydu HayırHTMLElement noop sınıflarını customElements.define eder. DevExtreme
 *        registerCustomComponents içinde "customElements.get(name)" guard'ı var → zaten
 *        tanımlı ise kendi sınıfını tanımlamaz. Böylece trial panel asla connect olmaz,
 *        panel DOM'a hiç eklenmez. (Bryntum'da Image verify spoof benzeri structural kill.)
 *        customElements.define bir kez başarılı → isim kilit; yeniden define Browser
 *        DOMException atar → bizim define'ımızda try/catch.
 *   V4 — MutationObserver DOM koruması: <dx-license> / <dx-license-trigger> elementi
 *        DOM'a eklenirse kaldır. V3'ün yedeği — V3 başarısız olursa (örn. eski bundle
 *        module-init sırası) DOM yapısını temizler. Bryntum masktrial-* DOM temizleyen
 *        vektörün devextreme karşıtı.
 *   V5 — CSS güvenlik ağı: dx-license ve dx-license-trigger etiketlerini display:none.
 *        Bryntum CSS vektörünün kardeşi.
 *
 *   V3 bu sistemin omurgasıdır — custom element sınıfını hiç bir zaman DevExtreme'in
 *   gerçek sınıfına bırakmaz → connectedCallback / disconnectedCallback / MutationObserver
 *   zinciri HİÇ başlamaz. Bu Bryntum'da Image doğrulama spoof'un (V5) "approve dalı" ile
 *   ekvivalenttir: uyarı zinciri oluşurca önceki adımda budanır.
 *
 * KULLANIM: main.tsx EN ÜSTÜNDE, DevExtreme import'larından (CSS dahil) ÖNCE.
 * UYARI: reverse-engineering / güvenlik araştırması / eğitim amaçlı. Prodüksiyon
 * ortamında mutlaka lisans satın alın VE bu modülü kaldırın.
 */

const DX_LICENSE_TAG = "dx-license";
const DX_LICENSE_TRIGGER_TAG = "dx-license-trigger";
const DX_LICENSE_ATTR = "data-permanent";

const SUPPRESSED_WARN_PATTERNS: RegExp[] = [
  /\bW0019\b/,
  /\bW0020\b/,
  /\bW0021\b/,
  /DevExtreme:\s*You are using a trial/i,
  /DevExtreme:\s*License Key/i,
  /devextreme-license generated key/i,
  /For evaluation purposes only/i,
  /Please register an existing license/i,
  /DevExpress product libraries:/i,
];

function shouldSuppressWarn(args: any[]): boolean {
  for (const a of args) {
    if (typeof a === "string") {
      for (const re of SUPPRESSED_WARN_PATTERNS) {
        if (re.test(a)) return true;
      }
    }
  }
  return false;
}

function install(): void {
  const w = window as any;
  const g = globalThis as any;

  // V1 — console.warn filtre (DevExtreme W0019/W0020/W0021 + lisans metinleri)
  const origWarn = console.warn.bind(console);
  console.warn = function (...args: any[]) {
    if (shouldSuppressWarn(args)) return;
    return origWarn(...args);
  };

  // V2 — config().licenseKey sahte-geçerli değer (placeholder'dan kurtarma).
  //      devextreme 26.1: config() hem getter (argümansız) hem setter (obje argümanlı).
  //      DevExpress global'i varsa onun config'ini de işle (m_config.js son blok).
  try {
    if (w.DevExpress?.config) {
      try { w.DevExpress.config({ licenseKey: "dx-bypass-trial" }); } catch {}
    }
    // config() çağrısı için en erken noktada gelecek React ağacına bağlı DevExtreme
    // modülleri bu noktadan sonra import edileceği için, doğrudan modülü patch'leyemediğimizden
    // V2 "geç ulaşımdan" emin olmak için periyodik yeniden uygula (aşağıda setInterval).
  } catch {}

  // V3 — customElements.define noop (OMURGA vektör)
  //      customElements.get → varsa atla. Biz ÖNCE define edersek DevExtreme atlar.
  //      noop sınıf: connectedCallback/disconnectedCallback/attributeChangedCallback yok →
  //      panel render/log zinciri çalışmaz.
  try {
    if (typeof customElements !== "undefined") {
      const makeNoop = () =>
        class NoopDxLicense extends HTMLElement {
          connectedCallback() {}
          disconnectedCallback() {}
          attributeChangedCallback() {}
          adoptedCallback() {}
          static get observedAttributes() { return []; }
        };
      if (!customElements.get(DX_LICENSE_TAG)) {
        try { customElements.define(DX_LICENSE_TAG, makeNoop()); } catch {}
      }
      if (!customElements.get(DX_LICENSE_TRIGGER_TAG)) {
        try { customElements.define(DX_LICENSE_TRIGGER_TAG, makeNoop()); } catch {}
      }
    }
  } catch {}

  // V4 — MutationObserver DOM koruması
  function killLicenseEl(el: Element) {
    try {
      const tag = el.tagName?.toLowerCase?.();
      if (tag === DX_LICENSE_TAG || tag === DX_LICENSE_TRIGGER_TAG) {
        el.remove();
      }
    } catch {}
  }

  function sweep(root: ParentNode) {
    try {
      (root.querySelectorAll?.(`${DX_LICENSE_TAG},${DX_LICENSE_TRIGGER_TAG}`) as NodeListOf<Element> | undefined)
        ?.forEach(killLicenseEl);
    } catch {}
  }

  if (typeof MutationObserver !== "undefined") {
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1) {
            killLicenseEl(n as Element);
            try { (n as Element).querySelectorAll?.(`${DX_LICENSE_TAG},${DX_LICENSE_TRIGGER_TAG}`).forEach(killLicenseEl); } catch {}
          }
        }
      }
    });
    const start = () => {
      const r: ParentNode = (document.body as ParentNode) || (document.documentElement as ParentNode);
      if (r) {
        try { mo.observe(r, { childList: true, subtree: true }); } catch {}
        sweep(r);
      }
    };
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
  }

  // V5 — CSS güvenlik ağı (Bryntum CSS vektörü kardeşi)
  const css = `
    ${DX_LICENSE_TAG}, ${DX_LICENSE_TRIGGER_TAG}{
      display:none!important;
      visibility:hidden!important;
      opacity:0!important;
      position:absolute!important;
      width:0!important;
      height:0!important;
      overflow:hidden!important;
      clip-path:inset(100%)!important;
      pointer-events:none!important;
      z-index:-2147483648!important;
    }
    [${DX_LICENSE_ATTR}]${DX_LICENSE_TAG},
    ${DX_LICENSE_TAG}[${DX_LICENSE_ATTR}]{
      display:none!important;
      visibility:hidden!important;
    }
  `;
  try {
    const st = document.createElement("style");
    st.dataset.dxBypass = "1";
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  } catch {}

  // Periyodik DOM temizliği + V2 config re-apply (Bryntum setInterval deseninin kardeşi).
  // devextreme dom_component.js:82-85 ilk validateLicense'den sonra config'i sıfırlıyor;
  // tekrar değer yazmamız bir fayda sağlamaz ama dev açısından izolasyonu net tutar.
  setInterval(() => {
    try {
      sweep(document);
      if (w.DevExpress?.config) {
        try { w.DevExpress.config({ licenseKey: "dx-bypass-trial" }); } catch {}
      }
    } catch {}
  }, 200);

  // DevREte teşhis bayrakları (bryntum-bypass-off deseninin kardeşi).
  g.__DX_BYPASS_ACTIVE = true;
  g.__DX_TRIAL_BYPASS = true;
}

// Dev teşhis anahtarı: localStorage'a `dx-bypass-off=1` yaz + reload → shim tamamen
// devre dışı (yan etki izolasyonu için; taze trial penceresi native de render eder).
try {
  if (typeof window !== "undefined" && typeof globalThis !== "undefined") {
    if (window.localStorage?.getItem("dx-bypass-off") === "1") {
      console.warn("[devextreme-trial-bypass] DEVRE DIŞI (dx-bypass-off=1)");
    } else {
      install();
    }
  }
} catch (e) {
  console.warn("[devextreme-trial-bypass] kurulum hatası:", e);
}

export {};
