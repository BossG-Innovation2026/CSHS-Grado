# Grades workflow design

Status: **final-grade submission and adviser consolidation built; later steps proposed**.
Revised 2026-11-09 after the owner clarified the portal's purpose.

## 1. Purpose

Grado does **not** compute grades and has no grade parts. Teachers compute grades outside the
portal (for example in their class records). Grado receives one finished number:

- A subject teacher submits **one final grade per learner, per subject, per term**.
- The class adviser sees those grades **consolidated** for every subject in the class.

Do not add raw scores, Written Works, Performance Tasks, exams, weights or transmutation.

## 2. Rules

| Rule | Detail |
|---|---|
| Value | Whole number from 60 to 100, the DepEd reporting scale (DO 015, s. 2026) |
| Who enters | Only the subject's assigned teacher; never a System Admin |
| Completeness | Every enrolled learner needs a grade before submitting |
| Submit | Locks the subject's grades for that term |
| Consolidation | Shows only submitted or approved grades, so teachers' drafts stay private |
| Consolidated view | Class adviser, System Admin, School Head, Registrar, Department Head |
| Retention | A class, subject or grade level with grades can't be deleted, and a learner with grades can't be unenrolled |
| Audit | Grade changes and submissions are written to `audit_log` (DO 015 para. 61) |

## 3. Data model

| Table | Purpose |
|---|---|
| `school_year`, `school_year_term` | Years, the current year, term dates and grade deadlines |
| `class.school_year_id` | The year a class belongs to |
| `final_grade` | `class_subject_id`, `student_id`, `grade`; `class_subject` already means one subject in one term |
| `grade_submission` | One row per subject-term: `draft`, `submitted`, `approved`, `returned`; no row means draft |
| `audit_log` | Append-only trail of changes |

## 4. Screens

| Page | Who | Content |
|---|---|---|
| `/grades` | Subject teacher | Their subjects this school year, with status |
| `/grades/[classSubjectId]` | Subject teacher | One grade per learner, Excel download and upload, submit |
| `/classes/[id]/grades` | Adviser and reviewers | Learners × subjects, by term, with each subject's status |
| `/settings/school-year` | System Admin | Years, current year, term dates |

## 5. Next steps

All of these work from submitted final grades, and none compute them.

1. **Approval:** the class's assigned Department Head or the School Head approves or returns a
   subject with a note. Returning unlocks it for the teacher.
2. **Registrar forms:** SF9 and SF10 per learner. A report card's year-end figures need a rule
   from the owner, since Grado computes nothing.
3. **Voucher codes:** advisers issue codes so learners and parents can view approved grades.
4. **Analytics:** submission progress and grade distribution for the School Head.

Useful screens may be ported from `feat/grades-records-portal` on the `experto2027/grado` remote.

## 6. Before real grades go in

DO 015 para. 61 limits digital records to official DepEd systems, networks or authorized drives.
Grado runs on Neon and Cloudflare, so get written authorization from the School Head or Division first.

The older `class_grade_name_uq` index must be dropped in the release after this one, before a
second school year reuses a section name.
