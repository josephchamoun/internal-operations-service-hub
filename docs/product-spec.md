# Product Spec: Internal Operations Service Hub

## 1. Problem / Context

Employees currently ask for help through messy, inconsistent channels (e.g., direct messages, hallway conversations, emails to the wrong inbox). Requests like "my laptop has a problem" or "I need approval for X" have no single, trackable entry point.

As a result:

- Requests get forgotten because they live in a person's DMs instead of a system of record.
- Requests get routed to the wrong person, who then has to manually forward them (if they even notice).
- There's no visibility into what's pending, who owns it, or how long it's been sitting.
- Employees don't know who to ask, so they guess, and guess wrong.

**The problem we are solving:** employees have no single, reliable place to submit internal requests (IT, HR, etc...) and have them automatically land with the right owner, get tracked, and get resolved without falling through the cracks.

## 2. Known Facts

- Requests currently arrive through multiple informal channels (chat, email, in-person).
- At least two clear request categories exist today: IT problems (e.g., laptop issues) and HR requests (e.g., approvals).
- There is no current system of record, requests are not centrally logged or tracked.
- Misrouting and lost requests are an active, recurring pain point.
- The organization has distinct teams/people who own different request types.
- The system will have its own dedicated login.

## 3. Actors / Stakeholders

### Actors (who directly interacts with the system)

- **Requester (Employee):** submits a request, needs status visibility, wants a fast and low-friction way to ask for help.
- **Owning Team:** owns and resolves requests routed to it (e.g., IT handling hardware/software problems, HR handling approvals and policy questions). The system supports multiple such teams.
- **System Admin / Hub Owner:** configures routing rules, categories, and manages the hub itself.

### Stakeholders (who cares about the system's success, even without using it hands-on)

- **Employees (end users):** care that requests get resolved quickly and that they don't have to chase people down. They are the primary users and the reason this project exists.
- **Owning teams (e.g., IT, HR):** care that requests reach them cleanly, with enough context, without being buried in noise from other categories. Their day-to-day workload is directly affected by how well routing works.
- **Company/Leadership:** cares about reducing lost or mishandled requests, since these have real cost (delayed resolutions, employee frustration, wasted time).
- **System Admin/Hub Owner:** cares about the system being maintainable and configurable as categories or teams change over time.

## 4. Functional Requirements

The system must:

1. Provide a single intake point where employees submit a request.
2. Support multiple request categories at minimum: IT and HR (extensible to more categories later).
3. Automatically route each request to the correct owner/team based on category (and sub-category where relevant, e.g., "laptop issue" → IT).
4. Assign a status to every request (e.g., New, In Progress, Resolved, Cancelled) so nothing is silently forgotten.
5. Only the current claimant on a request may change its status, aside from cancellation, which the requester may trigger themselves. The requester cannot mark their own request 'Resolved.' An unclaimed request must be claimed first before its status can be moved.
6. Notify every member of the owning team when a new request lands in their queue, since no individual is assigned to it until someone claims it.
7. Notify the requester when the owning team changes their request's status.
8. Allow any member of the current owning team to reassign a request to a different team if initial routing was wrong, with the new owning team notified.
9. Maintain a persistent, searchable record of all requests.
10. Allow employees to check the status of their own submitted requests without needing to ask the owner directly.
11. Ensure an employee can only see their **own** submitted requests and not requests submitted by other employees. Only the owning team (and the requester) can see a given request. The System Admin/Hub Owner is the one exception: they can view all requests across all categories and teams, since they are responsible for configuring routing and maintaining the hub.
12. The system must identify who submitted each request. Team or department association for each user is assigned by the Admin inside the hub, and a user may be assigned to more than one team at once; it is not assumed to come from the identity provider, since login only confirms who someone is, not their team(s).
13. The Admin defines and maintains the list of categories available at submission, each linked to a default owning team. The employee picks from that list. If none of the listed categories fit, the employee selects "Other," which then lets them pick the owning team directly for that submission.
14. Allow the requester to cancel their own request if it's no longer needed. A cancelled request stays in the system with a "Cancelled" status (not deleted) so the audit trail is preserved.
15. Allow the requester to edit their own request's details only while it is still in "New" status (not yet picked up by the owning team). Once the owning team has started working on it, the requester can no longer edit it directly.
16. If a request remains untouched by the owning team for a defined period after submission, the system must automatically send a reminder or escalation notification to the owning team, unless that team has silenced escalation for this specific request.
17. Category selection is mandatory at submission, either from the Admin-defined list or "Other" with a manually picked team, so no request is ever left uncategorized. If the wrong category or team is picked, it can still be corrected via reassignment.
18. If a request is misrouted and contains sensitive information, the receiving team should be able to recognize it doesn't belong to them and send it to the correct team without opening or viewing the sensitive details. If a team member chooses to view it anyway, that is on them and not something the system can prevent.
19. Allow a member of the owning team to claim a request, becoming its sole assignee. Only one team member may hold a claim on a request at a time; the rest of the team can still see it in the shared queue, marked as claimed and by whom, but cannot claim it themselves until it is unclaimed. A claimed request can be unclaimed, or the request itself reassigned to a different team. When a request becomes unclaimed, the whole owning team is notified again, the same as when it first arrived. Claiming itself does not trigger a separate notification, since the team's queue already reflects the change as it happens.
20. Allow the requester and the owning team to exchange messages on a request at any point while it is not Resolved or Cancelled. Messages form a single ongoing thread, not limited to one exchange or tied to a specific status. Sending a message never changes the request's status on its own. The recipient side (the requester if the team sent it, the owning team if the requester sent it) is notified of a new message, since live updates alone only reach someone actively viewing the request at that moment.
21. Allow the requester to attach files (e.g., photos, screenshots, documents) to a request at submission time, and optionally with a message. Attachments follow the exact same visibility rules as the rest of the request. Only the requester and the current owning team can view them; no other team or employee can access them. Whoever uploaded an attachment can edit or remove it only while the request is still in 'New' status. Once the owning team has started working on it, attachments become read only, including for whoever added them.
22. Provide a filterable view of requests by status (New, In Progress, Resolved, Cancelled), and for owning teams, additionally filterable by category, so requesters and owning teams can find relevant requests without scanning a flat unsorted list. This filtering respects the same visibility rules as everywhere else: a requester only filters within their own requests, an owning team only filters within requests routed to them, and the Admin can filter across all requests and all categories.
23. The System Admin must be able to assign each user's role within the hub (employee, member of one or more owning teams such as IT or HR, admin). This is independent of whatever team or department an external identity system may report; the hub's own role determines what someone can actually do inside the hub.
24. A user who holds an owning-team role can still submit requests as a regular employee. This holds regardless of how many teams the user belongs to. The category chosen determines the single owning team for that request, independent of the submitter's own team memberships. A member of one owning team (e.g., IT) submitting a request that belongs to a different team (e.g., HR) is routed there exactly as it would be for anyone else.
25. Allow each team member to silence escalation reminders for a specific request individually, for cases where they've seen it and are deliberately holding off rather than having forgotten it. Silencing only affects that one person; it does not silence the reminder for the rest of the owning team, so the system keeps notifying anyone on the team who hasn't silenced it themselves. A silenced request stops reminding that specific person until they un-silence it, or until they claim or reassign it, at which point normal escalation rules apply again for them.
26. The Admin defines a fixed list of priority levels (e.g. Low, Normal, Urgent), each with its own default escalation window. The requester picks one from that list at submission (defaulting to Normal if left unset); any member of the owning team can change it after seeing the request, not only whoever has claimed it, since correcting an over-marked priority is often most useful right when the request lands, before anyone's claimed it yet. This follows the same pattern as category selection: a fixed, Admin-maintained list rather than free text.
27. The escalation scheduler's check frequency and the actual reminder frequency are independent. The scheduler may check for stale requests often (e.g. every couple of hours) without reminding the team that often; a reminder for a given request only goes out once the priority level's escalation window has elapsed since the last reminder for that request.
28. If a team member opens the full details of a request outside their own team's queue (i.e. a request they can only see the limited misrouted-view of), that access is logged with who and when. This log is visible only to the Admin. It does not prevent the access, it only makes an otherwise-invisible decision visible for oversight.

## 5. Non-Functional Requirements

- **Reliability:** no request should be lost once submitted. The system is the source of truth, replacing informal channels.
- **Traceability:** every request must have an audit trail (who submitted it, when, who it was routed to, status changes over time).
- **Usability:** submitting a request must take about as little effort as sending a chat message to a coworker directly. If the system is harder or slower to use than just messaging someone informally, employees will keep bypassing it and the whole point of the system (centralizing and tracking requests) fails.
- **Privacy:**
  - An employee can only see their own submitted requests, never other employees' requests.
  - Each request is only visible to the requester and the team it was routed to (e.g., an IT request is only visible to IT, an HR request only to HR), no other team or the general employee population can see it, with the System Admin as the one exception, who can view all requests for the purpose of maintaining the hub.
  - Attachments (photos, files) are covered by the same visibility rule as the request itself.
- **Status update latency:** once the owning team changes a request's status, the requester should see that update within a reasonable, short time frame.
- **Availability:** the hub should be accessible during normal working hours at minimum; downtime should not silently swallow incoming requests.
- **Scalability / Load handling:** the system must behave correctly and consistently even when many requests are submitted at once, or many employees use it at the same time. No dropped requests, no incorrect routing, no duplicate submissions under load.
- **Extensibility:** the system must support adding new request categories/teams without a redesign.

## 6. Assumptions / Constraints / Unknowns

**Assumptions:**

- Employees have the basic means to access this new system (e.g., a company device with a browser).
- The company already has some record of who works where that this system can rely on.
- IT, HR and other teams are willing and able to adopt a new tool as part of their daily workflow. They are also users of the system, not just requesters' targets.
- Each request category has a clearly identifiable owning team.
- Volume is low-to-moderate, not high-throughput/public-facing scale.
- Live update traffic per request is expected to be very low, often zero, since many requests move from New to Resolved with a single status change and no messages exchanged at all. This is why a lightweight one-directional push is sufficient rather than a full bidirectional protocol.

**Constraints:**

- Must replace the existing informal channels employees already use, or adoption will fail.
- Whoever builds and maintains this system (development time, hosting, ongoing support) is a real cost. The project needs someone responsible for keeping it running, not just building it once.
- Rolling out a new system means employees need to be told where to go and how to use it, a communication step is required, or requests may still leak into old informal channels out of habit.

**Unknowns:**

- What tools/platforms are already in use at the company (chat app, email, Jira, ServiceNow, etc...) that this hub should replace.
- Expected volume of requests (10/week vs. 1000/week) affects design significantly.
- SLAs (Service Level Agreements): No specific response or resolution times have been defined for different issue categories or priorities.
- Whether employees need a mobile-friendly interface or web/desktop is sufficient.
- Maximum file size/type restrictions for attachments, and how long attachment storage is retained, are not yet defined.

## 7. Non-Goals

This product is deliberately **not** solving:

- Managing full HR processes. This system only tracks HR _requests_ an employee submits (e.g., "I need approval for X"), it is not an HR management platform.
- Tracking or managing IT equipment. This system only tracks IT _problems/requests_ employees report (e.g., "my laptop won't turn on"), it does not replace an asset-management tool.
- General project management or task tracking unrelated to employee-submitted requests.
- External-facing (customer) support. This is strictly an internal employee tool.

## 8. Acceptance Criteria

The system is considered working when:

#### Intake & Categorization

**Single entry point**
Given an employee is logged in, when they open the request form, then they see a single form covering all request categories (no separate forms or entry points per category).

**Category list maps to teams**
Given the Admin-defined category list, when an employee opens the request form, then every category shown maps to a default owning team, and "Other" is always present as the final option.

**"Other" requires a manual team pick**
Given an employee selects "Other," when they proceed, then they must explicitly pick an owning team before the request can be submitted.

**Category is mandatory**
Given an employee attempts to submit a request, when no category (or, for "Other," no team) has been selected, then submission is blocked and the employee is shown which field is missing.

**Owning team auto-assigned**
Given a request is submitted with a category, when it is created, then its owning team is set automatically from that category's default mapping with no manual step required.

---

#### Routing & Reassignment

**Correct initial routing**
Given a submitted request with category X, when it is created, then it appears only in category X's default owning team's queue.

**Reassignment moves the request and notifies**
Given a request currently owned by Team A, when any member of Team A reassigns it to Team B, then it moves out of Team A's queue, into Team B's queue, and Team B is notified as if it were newly submitted.

**History survives reassignment**
Given a request is reassigned, when the change completes, then the request's history/timestamp from before the reassignment is preserved (not reset or lost).

**Misrouted sensitive requests can be redirected unopened**
Given a request contains sensitive details and lands in the wrong team's queue, when a receiving team member views only the queue-level (limited) view, then they can identify it doesn't belong to them and reassign it without opening the full request body or attachments.

**Submitter role doesn't affect routing**
Given a user holds an owning-team role (e.g., IT) and also submits a request as an employee, when that request's category maps to a different team (e.g., HR), then it routes to that team exactly as it would for any other employee. The submitter's own role has no effect on routing.

---

#### Status & Claiming

**New requests start unclaimed**
Given a newly submitted request, when it is created, then its status is "New" and it is unclaimed.

**Claiming makes one person the sole claimant**
Given an unclaimed request, when any member of the owning team claims it, then that member becomes its sole claimant and no other team member can claim it while it remains claimed.

**Unclaimed requests can't have status changed**
Given a request is unclaimed, when any owning-team member (not just a specific assignee) attempts to change its status, then the system rejects the change until someone claims it first.

**Only the claimant can change status**
Given a request is claimed by user X, when a different owning-team member attempts to change its status, then the system rejects the change.

**Claimant can update status**
Given a request is claimed, when the claimant marks it "Resolved," "In Progress," or another valid status, then the change succeeds and is visible to the requester.

**Requester can never self-resolve**
Given a request in any status, when the requester attempts to set it to "Resolved," then the system rejects the change (requesters may only cancel, never resolve, their own request).

**Unclaiming reopens the request to the team**
Given a claimed request, when the claimant unclaims it, then it returns to the shared queue as unclaimed and available for anyone on the team to claim, and the whole team is notified as if it were newly arrived.

**Reassignment clears the claim**
Given a claimed request, when it is reassigned to a different team, then it becomes unclaimed in the new team's queue (the previous claim does not carry over).

**Claim status visible to the rest of the team**
Given a claimed request, when other team members view the shared queue, then they see it marked as claimed and by whom, even though they cannot claim it themselves.

**Claiming itself doesn't trigger a notification**
Given a request is claimed, when the claim itself occurs (no unclaim, no reassignment), then no additional team-wide notification is sent beyond the queue view updating live.

---

#### Notifications

**Whole team notified on arrival**
Given a new request lands in a team's queue, when it is created, then every member of that team is notified, since no individual is yet assigned.

**Requester notified on status change**
Given the owning team changes a request's status, when the change is saved, then the requester is notified of the new status.

**Stale requests trigger escalation**
Given a request has sat unclaimed/untouched past its priority level's escalation window, when the scheduler detects this, then a reminder is sent to the owning team.

**Silencing is per-person, not team-wide**
Given a team member has silenced escalation reminders for a specific request, when the next reminder for that request would otherwise fire, then that individual does not receive it, but other team members who have not silenced it still do.

**Silencing lifts on un-silence, claim, or reassignment**
Given a team member silenced a request's reminders, when they later un-silence it, claim it, or reassign it, then normal escalation reminders resume for them.

**Scheduler frequency independent of reminder frequency**
Given the escalation scheduler runs on a fixed check interval (e.g., every couple of hours), when it checks a request whose escalation window has not yet elapsed since the last reminder, then no new reminder is sent, even though the scheduler ran.

---

#### Records, Traceability & Search

**Full audit trail retained**
Given any request ever submitted, when queried later, then a persistent record exists with who submitted it, when, what it was routed to, and its status history over time.

**Search within permitted scope**
Given the Admin or an owning team searches within their permitted scope, when they enter search terms, then matching requests are returned without needing to scan a full unsorted list.

**Out-of-team full-view access is logged**
Given a team member opens the full details of a request outside their own team's queue (i.e., one they could otherwise only see the limited misrouted view of), when that access occurs, then it is logged with who accessed it and when.

**Access log visible only to Admin**
Given such an access log entry exists, when anyone other than the Admin attempts to view it, then they cannot; only the Admin can see this log.

**Logging observes, doesn't block**
Given the access-logging behavior above, the system does not block or prevent the out-of-team view itself. It only records that it happened.

---

#### Login & Authentication

**Login uses the hub's own screen**
Given an employee opens the hub, when they are not logged in, then they land on the hub's own login screen rather than any other entry point.

**Identity is verified through the company identity provider**
Given a user submits credentials on the login screen, when the hub checks them, then it verifies identity through the company's existing identity provider rather than storing or checking passwords itself.

**Identity provider outage blocks login**
Given the identity provider is unreachable, slow, or returns an error, when a user attempts to log in, then login is blocked and a clear error is shown, rather than the hub guessing at who the person is.

**No access without a session**
Given a user has not logged in, when they attempt to view any request, queue, or search result, then access is denied.

**Login does not grant a team or role by itself**
Given a user successfully logs in through the identity provider, when their session starts, then their role and team membership come only from the Admin's assignment inside the hub, never from anything the identity provider reports.

---

#### Visibility & Access Control

**Employees see only their own requests**
Given an employee is logged in, when they view their request list, then they see only requests they personally submitted.

**Cross-employee access denied**
Given an employee attempts to view another employee's request by any means (direct link, search, filter), when they try, then access is denied.

**Team members see only requests routed to their teams**
Given an owning-team member views their queue, when they look at requests, then they see only requests routed to any team they belong to, not requests routed to teams they are not a member of.

**Admin sees everything**
Given the System Admin is logged in, when they view requests, then they can see all requests across all categories and teams.

**Identity-provider team data is ignored for permissions**
Given a user's team/department affiliation as reported by the identity provider, when they log in, then the hub does not use that value to determine their role or team. It uses only the Admin-assigned role inside the hub.

**Admin-assigned role and team memberships determine permissions**
Given the Admin assigns a user a role (employee, owning-team member, admin) and, for team members, one or more team memberships, when that assignment is saved, then the user's permissions in the hub reflect exactly that role and team set going forward.

**Team filters stay within the member's own teams**
Given a team member's set of team memberships, when they filter their queue, then filtering by status, team, and category returns only requests already visible to them through those memberships (never a team they don't belong to).

**Employee filters stay within their own requests**
Given an employee filters their own request list by status, when they apply the filter, then results are limited to their own requests, filtered as requested.

---

#### Team Membership

**A user can belong to more than one team**
Given the Admin assigns a user to two or more teams, when the assignment is saved, then the user has standing membership in every team assigned, not just the most recent one.

**Membership in one team doesn't grant visibility into another**
Given a user is a member of Team A only, when they attempt to view a request routed to Team B, then access is denied, same as any employee with no relationship to Team B.

**New request notifies only members of the owning team**
Given a request is routed to Team A, when it is created, then only users who are members of Team A are notified. A user who belongs to Team B but not Team A is not notified, even if they belong to other teams the requester might expect.

**Claim eligibility follows team membership, not team count**
Given a user belongs to multiple teams, when they claim an unclaimed request routed to any one of those teams, then the claim succeeds exactly as it would for a user belonging to only that one team.

**A request's owning team stays singular regardless of user memberships**
Given a user who belongs to multiple teams submits or reassigns a request, when the request is routed, then it is still assigned to exactly one owning team. User membership count never causes a request to be split or co-owned.

---

#### Editing & Cancellation

**Cancellation preserves the record**
Given a request the requester submitted, when they cancel it (in any status prior to Resolved), then its status becomes "Cancelled" and the record is retained, not deleted.

**Editable while New**
Given a request still in "New" status, when the requester edits its details, then the changes are saved.

**Locked once work starts**
Given a request has moved past "New" status (owning team has started work), when the requester attempts to edit its details, then the edit is rejected.

**Attachments editable while New**
Given a request in "New" status with an attachment, when the uploader edits or removes that attachment, then the change succeeds.

**Attachments locked once work starts**
Given a request has moved past "New" status, when anyone, including the original uploader, attempts to edit or remove an attachment, then the action is rejected (attachments become read-only).

**Attachment visibility matches request visibility**
Given attachments on a request, when anyone other than the requester or current owning team attempts to view them, then access is denied. Same visibility rule as the request itself.

---

#### Messaging

**Messages form one ongoing thread**
Given a request not in "Resolved" or "Cancelled" status, when the requester or owning team sends a message, then it is appended to a single ongoing thread visible to both sides.

**No new messages after closure**
Given a request in "Resolved" or "Cancelled" status, when either party attempts to send a new message, then the system prevents it.

**Messages don't change status**
Given a message is sent, when it is saved, then the request's status is unchanged as a result of the message alone.

**Recipient notified on new message**
Given a message is sent by one side, when it is saved, then the other side (requester if team sent it, team if requester sent it) receives a notification, independent of whether they are actively viewing the request.

---

#### Priority

**Priority pick with default**
Given the Admin-defined list of priority levels, when an employee submits a request, then they may pick one from that list, and if they leave it unset, it defaults to "Normal."

**Priority changeable by any team member**
Given a submitted request, when any member of the owning team (claimed or not) changes its priority, then the change is accepted and the request's escalation window updates to match the new priority level's default.

**Escalation window follows priority level**
Given a request's priority level, when its escalation window is calculated, then it uses that priority level's Admin-defined default window.

### Correct behavior examples

- _Example 1 (IT):_ Employee submits "my laptop won't turn on." The request is categorized as IT, routed to the owning team's queue, that team is notified, status shows "New" → "In Progress" → "Resolved" as it's worked, and the employee sees these updates without having to ping anyone.
- _Example 2 (HR):_ Employee submits "I need approval for X." The request routes to HR, is visible only to HR, and the employee receives status updates without seeing internal HR notes.
- _Example 3 (Misrouting recovery):_ An employee submits a request that's initially auto-categorized incorrectly (e.g., tagged as IT when it should have gone to HR). The receiving team reassigns it to the correct team in one action, and the requester is not asked to resubmit.

### Incorrect / failure behavior examples (what must NOT happen)

- _Failure 1 (Silent loss):_ An employee submits a request and it never appears in any team's queue. No notification, no record, no status. This is the exact problem the system exists to prevent, so it's a critical failure if it ever happens.
- _Failure 2 (Wrong visibility):_ An employee can see another employee's HR request through the requests list or search. This is a serious privacy failure, not just a bug, it would break trust in the system entirely.
- _Failure 3 (Self-resolving):_ A requester is able to mark their own request as "Resolved" without the owning team ever acting on it. This makes status meaningless and requests could get closed without actually being handled.
- _Failure 4 (Stuck request):_ A request sits in "New" status indefinitely with no notification ever sent to the owning team, and the requester has no way to find out anything is wrong. This recreates the original problem (forgotten requests) inside the new system.
- _Failure 5 (Load failure):_ Multiple employees submit requests at the same time (e.g., during a company-wide outage, many people report "my laptop isn't working" simultaneously) and some requests get dropped, duplicated, or routed to the wrong team because the system couldn't handle concurrent submissions.
- _Failure 6 (Broken reassignment):_ A request is misrouted and there's no way to reassign it, the employee has to resubmit from scratch, losing the original history and timestamp.
