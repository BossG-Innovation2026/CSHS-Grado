# Grades workflow design (DepEd Order 015, s. 2026)

Status: **proposed, not built**. Prepared 2026-11-09 from the full text of
[DO 015, s. 2026](https://www.deped.gov.ph/wp-content/uploads/DO_s2026_015r.pdf) and
Table 5 of [DO 8, s. 2015](https://www.deped.gov.ph/wp-content/uploads/2015/04/DO_s2015_08.pdf).
Paragraph references (¶) are to DO 015 unless noted. Section 13 lists what the order does
not settle; each item has a default so building can continue.

Scope is Senior High School (Key Stage 4, Grades 11–12), the only levels this school uses.
Kindergarten to Grade 3 descriptive grading is out of scope.

## 1. Rules the system must enforce

| Topic | Rule | Source |
|---|---|---|
| Scale | Numeric 60–100; passing is 75; 60 is the lowest reportable grade | ¶44, ¶50, ¶52; Annex D ¶10b, ¶18 |
| Terms | Three terms per school year | ¶7x; Annex G |
| Components | Written Works (WW), Performance Tasks (PT), Examinations (EX) | ¶19, ¶44 |
| Examinations | Summative Test 1 30%, Summative Test 2 30%, Term Exam 40% of the EX weight | ¶45; Annex D ¶6 |
| Formative work | Never part of a grade | ¶15 |
| SY 2026–27 | Initial Grade goes through the Adjusted Transmutation Table | ¶48; Annex D Table 4 |
| SY 2027–28 on | Zero-based: no transmutation; report-card floor of 60 | ¶50; Annex D ¶15, ¶18 |
| Term Grade | Whole number | ¶7w; Annex D Step 5 |
| Final Grade | Average of the term grades, rounded to a whole number; passing at 75 | ¶7j, ¶52 |
| Multi-part areas | Effective Communication / Mabisang Komunikasyon passes if the averaged Final Grade is 75 or more, even if one part fails | Annex D ¶20 |
| General Average | Average of Final Grades, whole number; SHS uses equivalent units | ¶53 |
| Descriptors | Every grade shows its band: 90–100 Advancing, 80–89 Benchmarking, 75–79 Connecting, 65–74 Developing, 0–64 Emerging | ¶51, Table 11 |
| Reports | Report card (SF9) issued at the end of each term, with attendance | ¶59b, ¶70; Annex D ¶22c; Annex G |
| Attendance | Over 20% absences of prescribed class days means failing and no credit unless justified; School Head may exempt with documentation; intervene at about 12 absences by end of Term 1 | ¶70; Annex D ¶22 |
| Remediation | Starts as early as Week 5 after the first Summative Test | ¶68 |
| Promotion | Pass all: promoted. Fail 1–2: Summer Remedial Class. Still failing: conditional, one back subject per term. Fail 3 or more: retained | ¶67 |
| Recomputed grade | Average of Final Grade and Remedial Class Mark; 75 or more passes | ¶67b |
| SHS prerequisites | A failed prerequisite blocks the higher subject until cleared | ¶67d |
| Awards | General Average 90 or more, no Final Grade below 80, no derogatory record; listed alphabetically | ¶75 |
| Records | Keep assessments, raw scores and feedback at least one school year; access controlled, logged and documented; School Heads validate class records | ¶54, ¶61 |
| Storage | Digital records stay in official DepEd systems, networks or authorized drives | ¶61 (see section 13) |
| AI | No learner personal data in AI platforms; final grades are never determined by AI | ¶31e, ¶37, Table 6 |

### Weights

Strengthened SHS curriculum (Grade 11 in SY 2026–27), DO 015 Table 10:

| Group key | Subjects | WW | PT | EX |
|---|---|---|---|---|
| `core` | Core subjects | 20 | 50 | 30 |
| `academic_elective` | Other academic electives | 20 | 50 | 30 |
| `arts_sports_health` | Arts, Sports, Health and Wellness electives | 20 | 60 | 20 |
| `field_exposure` | Field Exposure, Arts Apprenticeship, Creative Production and Innovation | 15 | 70 | 15 (Term Exam only) |
| `research_design` | Research electives, Design and Innovation | 40 | 60 | none |
| `techpro_elective` | TechPro electives | 15 | 65 | 20 |
| `work_immersion` | Work Immersion | 20 | 80 | none |

Older curriculum (Grade 12 in SY 2026–27, per ¶49), DO 8 Table 5:

| Group key | Subjects | WW | PT | EX |
|---|---|---|---|---|
| `do8_core` | Core subjects | 25 | 50 | 25 |
| `do8_academic` | Academic track, all other subjects | 25 | 45 | 30 |
| `do8_academic_applied` | Academic track: Work Immersion, Research, Business Enterprise Simulation, Exhibit, Performance | 35 | 40 | 25 |
| `do8_tvl_sports_arts` | TVL, Sports, Arts and Design track, all subjects | 20 | 60 | 20 |

DO 015 changes only the weights for this group, so Grade 12 keeps the Summative Test and
Term Exam structure, with the DO 8 examination weight applied to EX. This is an inference
from ¶45 and ¶49.

## 2. Key design decisions

1. **Policy lives in code, versioned by school year, not in admin settings.** Weights and the
   transmutation table are national rules. A reviewed code change is safer than a settings
   screen, and "everything configurable" should not extend to changing how grades compute.
2. **Teachers enter raw scores; the system computes.** No screen accepts a typed term grade,
   except the one-time Term 1 import in section 13.
3. **Results are snapshotted at submission.** Approved grades keep the weights and policy used,
   so a later rule change never alters a past grade.
4. **Approval is by role and assignment, never by module alone.** System Admins always hold
   every module (`getPermissions`), and modules are editable per account, so the
   `grades_approve` module cannot be the only check. System Admins do not enter or approve grades.
5. **Grades block deletion.** Today, deleting a class or grade level cascades. Once a class has
   scores, those deletes must be refused to meet the retention rule.

## 3. Data model changes

Migrations run before new code goes live (`docs/PROJECT_CONTEXT.md` section 8), so each
change must keep the running version working.

### Changed tables

| Table | Change | Migration note |
|---|---|---|
| `school_settings` | Add `region`, `division`, `district` (SF9 header) | Nullable or default `''` |
| `subject` | Add `grading_group` (nullable until set); add `learning_area` (groups parts such as Effective Communication and Mabisang Komunikasyon) | Grades cannot start for a subject with no group |
| `class` | Add `school_year_id`, `curriculum` (`strengthened` or `do8`), `track`, `department_head_id` (nullable) | `school_year_id` is `NOT NULL DEFAULT '2026-2027'` first; drop the default in a later release |
| `class` unique index | Becomes (`school_year_id`, `grade_level_id`, `name`) | Add the new index now; drop the old one only in a later release, because the running code's `ON CONFLICT` targets it |
| `class_subject` | Add `grading_group` and `credit_units` snapshots | Filled from `subject` |

`class_subject` already holds one row per subject per term, which matches the three-term
model. A year-long core subject is three rows sharing a `code`, each with its own teacher and
submission. The Final Grade groups those rows by (`class_id`, `code`).

### New tables

| Table | Purpose | Main columns |
|---|---|---|
| `school_year` | Year and its rules | `id` (`2026-2027`), `starts_on`, `ends_on`, `is_current` (only one), `policy_key` |
| `school_year_term` | Term dates | `school_year_id`, `term`, `starts_on`, `ends_on`, `submission_deadline` |
| `assessment` | One task or test | `class_subject_id`, `component` (`ww`, `pt`, `st1`, `st2`, `te`), `title`, `highest_score`, `sort_order`; at most one each of `st1`, `st2`, `te` per subject-term |
| `score` | Raw score | `assessment_id`, `student_id`, `raw_score`, `status` (`scored`, `excused`), `updated_by`, `updated_at` |
| `grade_submission` | Workflow state, one per `class_subject` | `status` (`draft`, `submitted`, `approved`, `returned`), `submitted_by/at`, `decided_by/at`, `return_note`, `policy_key`, `weights` (JSON snapshot) |
| `term_grade` | Computed result | `class_subject_id`, `student_id`, `ww_ps`, `pt_ps`, `ex_ps`, `initial_grade`, `term_grade`, `source` (`computed`, `imported`) |
| `school_month` | Prescribed class days | `school_year_id`, `term`, `month`, `class_days` |
| `attendance_month` | Monthly attendance | `enrollment_id`, `term`, `month`, `days_present`, `days_absent` |
| `attendance_exemption` | School Head exemption | `enrollment_id`, `reason`, `document_ref`, `decided_by`, `decided_at` |
| `term_comment` | Adviser remark on SF9 | `enrollment_id`, `term`, `comment` |
| `remedial_mark` | Summer Remedial Class result | `enrollment_id`, `code`, `mark`, `recorded_by` |
| `access_voucher` | Student or parent access | `student_id`, `school_year_id`, `code_hash`, `issued_by`, `expires_at`, `revoked_at` |
| `audit_log` | Append-only trail | `at`, `actor_id`, `action`, `entity`, `entity_id`, `detail` (JSON) |

Foreign keys from `assessment`, `grade_submission` and `term_grade` use `restrict`. Class,
grade-level, subject-setup and unenroll actions check first and show a clear message.

Estimated size: 1,000 students × 10 subjects × 3 terms × 9 tasks is about 270,000 score rows a
year, likely tens of megabytes, which is well within Neon's 1 GB.

## 4. Grade computation

A pure module (`src/lib/grading/`) with no database or framework imports:

```text
computeTermGrade(policy, group, assessments, scores) -> { wwPs, ptPs, exPs, initialGrade, termGrade }
```

Steps for each learner (Annex D ¶2–6):

1. WW and PT: sum raw scores, divide by the sum of highest scores, multiply by 100.
2. EX: convert each test to a percentage, then combine 30/30/40. `field_exposure` uses the
   Term Exam alone.
3. Multiply each percentage by its weight and add the results to get the Initial Grade.
4. `transition-2026`: look up the Adjusted Transmutation Table. `zero-based`: round to a whole
   number, with a minimum of 60.

Decimal maths must not use binary floats. Values are rounded to two decimals at each step
(see section 13, item 6). Table bands are stored once and tested for gaps.

Required tests use the order's own worked examples: Annex D Table 5 gives 88 and Table 6
gives 84. Tests also cover every transmutation band edge and every weight group. The repo has
only E2E suites today, so this adds a unit-test runner.

| `policy_key` | Applies to | Weights | Conversion |
|---|---|---|---|
| `transition-2026` | SY 2026–27 | By `curriculum` and group | Adjusted table |
| `zero-based` | SY 2027–28 onward | Strengthened groups | None; floor of 60 |

## 5. Workflow

```text
draft -> submitted -> approved
  ^          |            |
  |          v            | reopen (School Head only, reason required)
  +------ returned <------+
```

Every transition is one conditional update (`WHERE status = expected`) inside a transaction
that also writes `audit_log`, so two people acting at once cannot both succeed.

| Step | Who | Check | Password re-entry |
|---|---|---|---|
| Add or edit scores | That subject's teacher | `class_subject.teacher_id`, status `draft` or `returned` | No |
| Submit | That subject's teacher | Every enrolled learner has a score or `excused` on every assessment; all required components exist; `term_grade` written | No |
| Approve or return | School Head, or the class's assigned Department Head | Role plus assignment; cannot act on own submission | Approve only |
| Reopen approved | School Head | Reason required | Yes |
| Read consolidated sheet | Adviser, School Head, Registrar, assigned Department Head | `canViewRoster`, narrowed once assignments exist | No |

Assessment-count guidance (3–5 WW, 2–3 PT per term, ¶24, Table 3) shows as a warning and never
blocks, because the order calls it flexible guidance.

## 6. Screens

| Page | Role | Content |
|---|---|---|
| `/grades` | Subject teacher | Their subject-terms with status |
| `/grades/[classSubjectId]` | Subject teacher | Grid of learners × assessments, live computed term grades, Excel template upload and download, submit |
| `/classes/[id]/sheet` | Adviser and reviewers | Learners × subjects per term, each subject's status, Final Grades |
| `/classes/[id]/attendance` | Adviser | Monthly days present and absent, 20% and 12-absence warnings |
| `/grades/approval` | School Head, Department Head | Queue, read-only subject view, approve or return with note |
| `/registrar` | Registrar | SF9 per learner or class, SF10, Recomputed Final Grade certificate |
| `/codes` | Adviser | Issue and revoke vouchers |
| `/view` | Student or parent (public) | Approved grades for one learner |
| `/dashboard` analytics | School Head | Section 10 |
| `/settings/school-year` | System Admin | Years, terms, class days, current year |

The subject-teacher dropdown (`listActiveTeachers`) currently lists only `teacher` accounts. It
should widen to any active staff holding `grades_submit`, since Department Heads may teach.

Score saves use the batched `INSERT … ON CONFLICT` pattern. Uploads match learners by LRN,
reuse the existing 2 MB and 2,000-row limits, and reject scores above the highest score.

## 7. Attendance

The official daily record remains School Form 2; Grado stores the monthly summary the report
card needs (Annex G). Absence rate is computed against prescribed class days for the year.
Failing for attendance applies only after the year ends and only without an exemption.

## 8. Reports

Reports are print-styled HTML pages saved to PDF from the browser, because server PDF
generation is unlikely to fit the 10 ms CPU and 3 MB Worker limits.

- **SF9:** follows Annex G: header, learner details, track, subjects by term, Final Grade,
  remarks (75 and above Passed, below 75 Failed), descriptor key, General Average, attendance,
  term comments, parent signature lines, certificate of transfer.
- **SF10:** needs the current official template (section 13, item 7).
- **Certificate of Recomputed Final Grade:** Annex D Figure 7.

Each generated report writes to `audit_log`.

## 9. Student and parent access

- A voucher is a random 12-character code shown once. Only a keyed HMAC-SHA-256 hash is stored.
  The code is high-entropy, so it does not need scrypt, which protects the CPU limit.
- `/view` asks for LRN and code, is rate limited per IP and per LRN, and returns the same error
  for every failure.
- It shows name, approved term grades, Final Grades and descriptors only.
- Each successful view is logged.

## 10. Analytics and awards

- School Head sees submission progress, descriptor distribution, pass rates per class and subject,
  and at-risk lists (below 75 after Summative Test 1, per ¶68; absences near the threshold).
- No rankings anywhere. Awards are listed alphabetically (¶75); a rank certificate is issued only
  on written request (¶76) and stays a manual process.
- An Academic Excellence candidate list applies the numeric test only. The Awards Committee and
  School Head still judge derogatory records and approve the final list (Annex H).

## 11. Year-end

After Term 3 approvals: compute Final Grades and General Average, apply attendance, classify each
learner under ¶67, record Remedial Class Marks, compute Recomputed Final Grades, and issue
certificates. Back-subject and prerequisite tracking waits for the Strengthened SHS guidelines.

## 12. Build order

Each phase is its own PR, with demo data so every role can try it on the demo site.
Columns are added in the phase that first uses them: `department_head_id` in phase 3, and
`track` and the `school_settings` SF9 fields in phase 4.

1. **Foundation:** school years, curriculum fields, migrations, grading module and unit tests.
   Follow-up in the next release: drop `class_grade_name_uq` and the `class.school_year_id`
   default. The old index blocks reusing a section name in a second school year until then.
2. **Score entry and submission:** grid, Excel, retention guards, audit log.
3. **Approval and consolidated sheet:** Department Head assignment, approve, return, reopen.
4. **Attendance and SF9.**
5. **Vouchers and `/view`.**
6. **Analytics and at-risk lists.**
7. **Year-end:** remedial marks, promotion, SF10, award candidates.

## 13. Open items

| # | Item | Default used in this design | Who settles it |
|---|---|---|---|
| 1 | ¶61 limits digital records to official DepEd systems, networks or authorized drives, and ¶61 has grades submitted through official forms and systems. Grado runs on Neon and Cloudflare | Build and test on the demo site only. **No real grades until authorized in writing.** Treat Grado as a supplement to official submission | School Head or Division |
| 2 | Voucher validity | Until the school year ends; revocable anytime | Owner |
| 3 | Term 1 of SY 2026–27 has already ended | One-time Excel import of final term grades (`source = imported`), through the normal approval | Owner |
| 4 | The order does not say how a missing score counts | Blank blocks submission. The teacher enters a score, including 0, or marks a Written Work or Performance Task excused, which removes it from that learner's highest-score total. Exams cannot be excused; the learner takes a make-up (Annex D ¶22) | School Head |
| 5 | SHS General Average "equivalent units" (¶53) await a separate Strengthened SHS issuance | Weight by `credit_units`; label provisional and leave it off SF9 until confirmed | DepEd issuance |
| 6 | Rounding before transmutation is not stated in DO 015 | Two decimals at each step, as in the DO 8 Table 6 sample. Compare with the division's Electronic Class Record before go-live | Division template |
| 7 | SF10 layout for the three-term calendar | Build last, from the official template | Registrar or Division |
| 8 | Annex D ¶13 names only Grades 4–10 for zero-based grading; ¶7aa and ¶50 include Grades 11–12 | Follow the main text and include SHS | Confirm with Division |
| 9 | Electives per term and subject prerequisites are left to the Strengthened SHS guidelines | Driven by the existing per-term subject setup; no prerequisite checks yet | DepEd issuance |
| 10 | ¶61 requires logged access | Log all changes, exports and voucher views; routine on-screen staff reads are not logged at first | School Head |
