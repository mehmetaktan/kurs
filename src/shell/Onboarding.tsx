import { useEffect, useState } from 'react'
import { tr } from '../i18n/tr'
import {
  fetchAppStatus,
  fetchSubjects,
  saveSubject,
  type AppError,
  type AppStatus,
} from '../lib/api'
import { navigate } from '../lib/router'
import { Button, ErrorState, Input, Modal } from '../ui'
import styles from './Shell.module.css'

type Phase = 'course' | 'subject' | 'student'

/** İlk boş veritabanında kurs bilgisi → branş → öğrenci sırasını görünür kılar. */
export function Onboarding({ currentPath }: { currentPath: string }) {
  const [phase, setPhase] = useState<Phase | null>(null)
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [hasSubject, setHasSubject] = useState(false)
  const [subjectName, setSubjectName] = useState('')
  const [error, setError] = useState<AppError | null>(null)
  const [saving, setSaving] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (currentPath !== '/' || dismissed) return
    let cancelled = false
    void Promise.all([fetchAppStatus(), fetchSubjects()])
      .then(([nextStatus, subjects]) => {
        if (cancelled || nextStatus.studentCount > 0) return
        setStatus(nextStatus)
        setHasSubject(subjects.length > 0)
        setPhase('course')
      })
      .catch(() => {
        // Yardım akışı ana ekranı engellemez; sayfanın kendi hata durumu görünür kalır.
      })
    return () => {
      cancelled = true
    }
  }, [currentPath, dismissed])

  const dismiss = () => {
    setDismissed(true)
    setPhase(null)
  }

  const continueFromCourse = () => setPhase(hasSubject ? 'student' : 'subject')

  const createSubject = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveSubject({
        id: null,
        name: subjectName,
        color: '#5F8F6B',
        defaultMin: null,
        sortOrder: 0,
      })
      setHasSubject(true)
      setPhase('student')
    } catch (caught) {
      setError(caught as AppError)
    } finally {
      setSaving(false)
    }
  }

  const openStudent = () => {
    setPhase(null)
    navigate('/ogrenciler?yeni=1')
  }

  return (
    <>
      <Modal
        open={phase === 'course'}
        title={tr.onboarding.course.title}
        description={tr.onboarding.course.description}
        dismissLabel={tr.onboarding.later}
        onClose={dismiss}
        actions={
          <Button variant="primary" onClick={continueFromCourse}>
            {tr.onboarding.course.continue}
          </Button>
        }
      >
        <div className={styles.onboardingCourse}>
          <span>{tr.onboarding.course.institution}</span>
          <strong>{status?.institutionName}</strong>
        </div>
      </Modal>

      <Modal
        open={phase === 'subject'}
        title={tr.onboarding.subject.title}
        description={tr.onboarding.subject.description}
        dismissLabel={tr.onboarding.later}
        onClose={dismiss}
        actions={
          <Button
            variant="primary"
            disabled={saving || subjectName.trim() === ''}
            onClick={() => void createSubject()}
          >
            {saving ? tr.actions.saving : tr.onboarding.subject.save}
          </Button>
        }
      >
        <Input
          autoFocus
          label={tr.onboarding.subject.label}
          placeholder={tr.onboarding.subject.placeholder}
          value={subjectName}
          onChange={(event) => setSubjectName(event.target.value)}
        />
        {error && <ErrorState inline message={error.message} details={error.details} />}
      </Modal>

      <Modal
        open={phase === 'student'}
        title={tr.onboarding.student.title}
        description={tr.onboarding.student.description}
        dismissLabel={tr.onboarding.later}
        onClose={dismiss}
        actions={
          <Button variant="primary" onClick={openStudent}>
            {tr.onboarding.student.open}
          </Button>
        }
      />
    </>
  )
}
