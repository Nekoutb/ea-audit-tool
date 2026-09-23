/**
 * The user-acceptance script: what a firm should exercise before trusting the
 * tool with a real audit, in the order an engagement actually runs.
 *
 * Kept as data rather than prose so the page can track a status and a note
 * against each item, count what is left, and stay honest about what was never
 * tried. `key` is the stable identifier a stored result points at — change the
 * wording freely, never the key, or a tester's answers detach from the
 * question they answered.
 *
 * `path` is a real route on this instance. The page turns it into a link, so a
 * tester goes straight to the screen instead of hunting for it. Where the route
 * needs an engagement id, `:id` is substituted with whichever engagement the
 * tester picks at the top of the page.
 */

export type UatStatus = "not_started" | "passed" | "failed" | "blocked";

export interface UatScenario {
  key: string;
  title: string;
  /** Why an auditor should care that this works — not a restatement of the steps. */
  why: string;
  /** Where to do it. `:id` is replaced with the selected engagement. */
  path?: string;
  steps: string[];
  expect: string;
}

export interface UatSection {
  key: string;
  title: string;
  intro: string;
  scenarios: UatScenario[];
}

export const UAT_SECTIONS: UatSection[] = [
  {
    key: "access",
    title: "1 · Getting in",
    intro:
      "Everything else depends on these. Test them with a colleague who has never opened the tool, on their own machine — not on yours, and not in a browser already signed in as you.",
    scenarios: [
      {
        key: "access.invite",
        title: "Invite a colleague and let them set their own password",
        why: "Nobody should ever be sent a password. The invitation proves the person controls the mailbox; the password is theirs alone, and no administrator is in a position to know it.",
        path: "/users",
        steps: [
          "Open Users and invite a colleague using an address that has never been used in this tool.",
          "Type their full name as it should appear, initials and all — for example “J. P. Mbarga”.",
          "Ask them to open the email. Confirm it names your firm, and that it contains a link and NO password.",
          "Have them click the link, choose a password, and confirm it.",
          "Have them sign in with the password they just chose.",
        ],
        expect:
          "The email carries a link and no credential. After setting the password they reach the dashboard. Their name appears exactly as typed — not guessed from the email address.",
      },
      {
        key: "access.invite-expired",
        title: "A used or superseded invitation stops working",
        why: "An invitation link sits in a mailbox forever. It must not still be able to set someone's password months later.",
        steps: [
          "Take the invitation link a colleague has already used and open it again.",
          "Invite the same person a second time, then open the FIRST link again.",
        ],
        expect:
          "Both attempts show “this link is no longer valid” and offer the sign-in page. Neither lets you set a password.",
      },
      {
        key: "access.reset",
        title: "Reset a colleague's password",
        why: "People lose passwords mid-audit. The firm must be able to restore access without anyone learning the new password.",
        path: "/users",
        steps: [
          "In Users, reset a colleague's password.",
          "Confirm they receive an email, and that any session they had open is closed.",
          "Have them use it to get back in and set a new password.",
        ],
        expect: "They regain access. Their previous session no longer works.",
      },
      {
        key: "access.wrong-password",
        title: "A wrong password is refused, and repeated attempts are slowed",
        why: "The file contains client confidences. Guessing must be unrewarding.",
        path: "/login",
        steps: [
          "Try to sign in with a correct address and a wrong password.",
          "Repeat it six or seven times in a row.",
        ],
        expect:
          "Each attempt is refused with the same message — it never reveals whether the address exists. After several attempts you are told to wait.",
      },
      {
        key: "access.language",
        title: "Work in French, then in English",
        why: "A bilingual firm signs bilingual files. The choice has to survive a page change, not just the screen you set it on.",
        steps: [
          "Switch the language on the sign-in page and sign in.",
          "Move through three or four different screens.",
          "Open a generated working paper.",
        ],
        expect:
          "Every screen and the generated document follow the language you chose, and it persists across pages.",
      },
    ],
  },
  {
    key: "separation",
    title: "2 · Separation — the test that matters most",
    intro:
      "If this section fails, nothing else is worth testing. Do it deliberately and adversarially. You will need two people: one on an engagement, one not.",
    scenarios: [
      {
        key: "sep.other-engagement",
        title: "A colleague cannot open an engagement they are not on",
        why: "Inside one firm, an audit team is not everybody. Staff should see the files they are assigned to and no others.",
        path: "/engagements",
        steps: [
          "Sign in as a staff member who is NOT on a particular engagement.",
          "Confirm that engagement does not appear in their list.",
          "Now copy the engagement's URL from your own browser and paste it into theirs.",
        ],
        expect:
          "The engagement is absent from the list, and the pasted URL does not open it. Guessing the address is not a way in.",
      },
      {
        key: "sep.partner-oversight",
        title: "A partner or firm administrator sees the whole portfolio",
        why: "The other half of the same rule. ISQM 1 puts oversight of every engagement on the partner; scoping them to their own assignments would break that.",
        path: "/engagements",
        steps: [
          "Sign in as a partner or firm administrator.",
          "Confirm every engagement in the firm is listed, including ones you are not personally on.",
        ],
        expect:
          "The full portfolio is visible. This is deliberate — confirm it matches how your firm expects oversight to work.",
      },
      {
        key: "sep.client-portal",
        title: "A client sees their own requests and nothing else",
        why: "The portal is the one place someone outside the firm is let in. It must expose the request list and never the audit file.",
        path: "/engagements/:id/pbc",
        steps: [
          "Request a document from a client.",
          "Sign in as that client on the portal and upload it.",
          "From the client's session, try to open an engagement URL and a working paper URL.",
        ],
        expect:
          "They can see and satisfy their own requests. Every attempt to reach the audit file is refused.",
      },
    ],
  },
  {
    key: "setup",
    title: "3 · Setting up an engagement",
    intro:
      "Take one real client you know well and set it up from nothing. Keep a note of anything you would normally do that the tool does not let you.",
    scenarios: [
      {
        key: "setup.client",
        title: "Create a client and an engagement",
        why: "The engagement's characteristics drive the whole file — the index, the tasks and the gates are built from them.",
        path: "/new-engagement",
        steps: [
          "Create the client, then the engagement: financial year, period end, and the entity's characteristics.",
          "Open the engagement and look at the file index that was generated.",
        ],
        expect:
          "The index matches the kind of entity you described. A small non-complex entity should not be carrying a listed company's programme.",
      },
      {
        key: "setup.team",
        title: "Build the team",
        why: "Roles here decide who may sign what, and who is asked to confirm independence.",
        path: "/engagements/:id/team",
        steps: [
          "Add a partner, a manager and two staff — mix colleagues who already have accounts with at least one brand-new address.",
          "Add more than four people. There is no limit; confirm that.",
          "Have one of them accept the engagement from their dashboard, and one decline it.",
        ],
        expect:
          "Everyone is added regardless of how many. New people receive the invitation described in section 1. Accept and decline both register.",
      },
      {
        key: "setup.acceptance",
        title: "Work through acceptance and independence",
        why: "Acceptance gates planning. A firm should not be able to start work it has not agreed to take.",
        path: "/engagements/:id/acceptance",
        steps: [
          "Complete client and engagement acceptance.",
          "Issue the independence campaign to the whole team and have them respond.",
          "Try to move into planning before acceptance is finished.",
        ],
        expect:
          "Planning stays shut until acceptance is complete, and the refusal says which item is outstanding.",
      },
    ],
  },
  {
    key: "planning",
    title: "4 · Planning",
    intro:
      "This is where the audit is actually designed. Check the arithmetic against how your firm does it today.",
    scenarios: [
      {
        key: "plan.materiality",
        title: "Set materiality",
        why: "Every judgement downstream — sample sizes, what goes on the SAD, what is trivial — hangs off these three numbers.",
        path: "/engagements/:id/tools/materiality",
        steps: [
          "Enter the benchmark and the percentage. Record planning materiality, performance materiality and the threshold for accumulating differences.",
          "Check the numbers against the same calculation done by hand.",
          "Have the partner approve it, then try to change it.",
        ],
        expect:
          "The figures match your own calculation. Once approved, a change creates a new version rather than editing the approved one.",
      },
      {
        key: "plan.scots",
        title: "Significant classes of transactions and what can go wrong",
        why: "The link from a process to a risk to a control to a test is the spine of a controls-based audit.",
        path: "/engagements/:id/tools/forms",
        steps: [
          "Record a significant class of transactions — revenue, say — and walk it through.",
          "Record what can go wrong, the assertions affected, and the controls that address them.",
          "Mark a control as one you intend to test.",
        ],
        expect:
          "The chain from process to risk to control holds together and reads the way your firm documents it.",
      },
      {
        key: "plan.cra",
        title: "Combined risk assessment",
        why: "The assessment decides the nature, timing and extent of everything that follows.",
        path: "/engagements/:id/cra",
        steps: [
          "Set inherent and control risk per assertion for a significant account.",
          "Look at the procedures the tool proposes as a result.",
          "Change one assessment and confirm the proposed work changes with it.",
        ],
        expect: "The programme responds to the assessment. It is not a fixed checklist.",
      },
    ],
  },
  {
    key: "execution",
    title: "5 · Execution",
    intro:
      "The bulk of the work. Attach real documents — a scanned invoice, a bank confirmation, a spreadsheet — not placeholder files, so you see how it behaves with what you actually handle.",
    scenarios: [
      {
        key: "exec.toc",
        title: "Test a control and conclude on it",
        why: "A control concluded ineffective must change the audit, not sit in a document nobody rereads.",
        path: "/engagements/:id/tools/forms",
        steps: [
          "Open E1.2 and conclude that a control is effective.",
          "Change the conclusion to not effective.",
          "Go and look at the combined risk assessment for the assertions that control covered.",
        ],
        expect:
          "Concluding “not effective” sets those assertions to not rely on controls automatically, with the reason recorded. You do not have to remember to do it.",
      },
      {
        key: "exec.sampling",
        title: "Draw a sample",
        why: "Sample sizes are a matter of professional judgement that a tool can get badly wrong.",
        path: "/engagements/:id/tools/sampling",
        steps: [
          "Define a population and draw a sample.",
          "Check the size against your firm's own table.",
          "Confirm the selection is reproducible and that the items chosen are recorded.",
        ],
        expect:
          "The size matches your methodology and the selection is documented, not re-drawn each time you look.",
      },
      {
        key: "exec.tb",
        title: "Import a trial balance and build a lead schedule",
        why: "This is the first thing that will be done on every real engagement, with a messy file.",
        path: "/engagements/:id/data",
        steps: [
          "Import a real trial balance — including one with formatting your firm would call untidy.",
          "Read what the tool says it could not interpret.",
          "Build a lead schedule from it and agree it to the trial balance.",
        ],
        expect:
          "It says clearly which figures it could not read rather than importing them silently wrong. The lead schedule agrees.",
      },
      {
        key: "exec.je",
        title: "Journal entry testing",
        why: "Required on every engagement, and the selection criteria are where it is usually done badly.",
        path: "/engagements/:id/tools/je-selection",
        steps: [
          "Load the journal file and apply the selection criteria.",
          "Confirm the entries selected are the ones your criteria describe.",
          "Document the testing of a selected entry.",
        ],
        expect: "The selection is risk-based and explainable to a reviewer — not a random sample.",
      },
      {
        key: "exec.attach",
        title: "Attach evidence to a task",
        why: "The evidence is the audit. Getting a document in and back out again has to be effortless.",
        steps: [
          "Attach a PDF, a Word file and an Excel file to a task.",
          "Download each one again and open it.",
          "Replace one with a newer version.",
          "Delete one, then restore it.",
        ],
        expect:
          "Files come back byte-for-byte. Versions are kept, not overwritten. A deleted attachment can be recovered.",
      },
      {
        key: "exec.review",
        title: "Review notes and sign-offs",
        why: "Review is the control that makes the file an audit rather than a collection of documents.",
        path: "/engagements/:id/tools/review-notes",
        steps: [
          "As a manager, raise a review note on a working paper.",
          "As the preparer, respond and clear it.",
          "Sign off the paper, then change it.",
        ],
        expect: "Changing signed work invalidates the sign-off rather than silently keeping it.",
      },
    ],
  },
  {
    key: "conclusion",
    title: "6 · Conclusion and archive",
    intro:
      "The end of the file, and the part that is hardest to undo. Read carefully before archiving — it is meant to be irreversible.",
    scenarios: [
      {
        key: "concl.sad",
        title: "Summary of audit differences",
        why: "It decides the opinion. The threshold arithmetic has to be right.",
        path: "/engagements/:id/tools/sad",
        steps: [
          "Record several misstatements, corrected and uncorrected.",
          "Check the totals, the tax effect and the turnaround against the same schedule done by hand.",
          "Confirm the threshold the uncorrected total is compared against is planning materiality less performance materiality.",
          "Export it to Excel and compare with your own workbook.",
        ],
        expect:
          "The numbers and the verdict match your own schedule, and the Excel export is one tab per schedule.",
      },
      {
        key: "concl.archive",
        title: "Archive the file, then try to change it",
        why: "ISA 230: once assembled, the file is closed. This is the guarantee that makes the tool an audit file rather than a folder.",
        path: "/engagements/:id/conclusion",
        steps: [
          "Complete the conclusion and archive the engagement.",
          "Now try to edit a working paper, attach a document, add a review note and delete something.",
        ],
        expect: "Every attempt is refused. The retention date is set and recorded.",
      },
      {
        key: "concl.export",
        title: "Export the complete file",
        why: "What a regulator, a successor auditor or an inspection will ask for.",
        steps: [
          "Export the whole engagement.",
          "Open the archive and check a few documents open correctly.",
          "Verify the checksum file against its contents.",
        ],
        expect:
          "The export contains the working papers themselves, not an index of them, and the checksums verify.",
      },
    ],
  },
  {
    key: "firm",
    title: "7 · Running the firm",
    intro: "Administration. Test as the firm administrator.",
    scenarios: [
      {
        key: "firm.branding",
        title: "The firm's own name and logo",
        why: "The tool is used in front of clients. It should carry your identity, not the vendor's or another firm's.",
        path: "/settings",
        steps: [
          "Set the firm's display name, accent colour and logo.",
          "Check the top-left of an engagement, a generated working paper and the client portal.",
        ],
        expect:
          "Your firm's name and logo appear everywhere. No other firm's name appears anywhere.",
      },
      {
        key: "firm.roles",
        title: "Change what someone may do",
        why: "The difference between staff and partner is the difference between preparing and approving.",
        path: "/users",
        steps: [
          "Change a colleague's role and have them sign in again.",
          "Confirm they can now do what the new role allows and not what it does not.",
          "Remove someone from the firm and confirm they can no longer sign in.",
        ],
        expect: "Permissions follow the role immediately, and removal takes effect at once.",
      },
      {
        key: "firm.trail",
        title: "The audit trail",
        why: "“Who changed this, and when?” is a question the firm will be asked, possibly years later.",
        path: "/engagements/:id/activity",
        steps: [
          "Make a handful of changes across the file.",
          "Open the activity trail and find them.",
          "Try to remove an entry.",
        ],
        expect: "Every change is there with who and when. Nothing can be deleted from it.",
      },
    ],
  },
];

export const ALL_SCENARIOS: UatScenario[] = UAT_SECTIONS.flatMap((s) => s.scenarios);

/** Keys are the contract with stored results; a duplicate would silently merge two answers. */
export function duplicateKeys(): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const s of ALL_SCENARIOS) {
    if (seen.has(s.key)) dupes.push(s.key);
    seen.add(s.key);
  }
  return dupes;
}
