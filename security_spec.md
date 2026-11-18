# Security Specification — المصحف الجامع

## 1. Data Invariants
- All user data (`/users/{userId}/sync/state`, `/users/{userId}/bookmarks/{bookmarkId}`, `/users/{userId}/notes/{noteId}`) belongs strictly to the authenticated, email-verified user whose `request.auth.uid == userId`.
- `/users/{userId}` is writable/deletable only by the owner (`request.auth.uid == userId`), and readable/listable only by the owner or the verified bootstrapped admin (`request.auth.token.email == 'abodama50007@gmail.com' && request.auth.token.email_verified == true`).
- Document `uid` fields must always match `request.auth.uid` on create and remain immutable on update.
- All document IDs (`userId`, `bookmarkId`, `noteId`) must match `^[a-zA-Z0-9_\-]+$` and stay within `<= 128` characters.
- All timestamps (`createdAt`, `updatedAt`) are strictly validated against `request.time`.
- All strings and arrays have strict type and `.size()` bounds; `keys().hasAll(...)` and `keys().hasOnly(...)` prevent shadow/ghost fields.

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. Unauthenticated read/list of `/users` or `/users/user1` -> `PERMISSION_DENIED`
2. Cross-user read/list of `/users/otherUser` or `/users` by non-admin `user1` -> `PERMISSION_DENIED`
3. Unverified email write or spoofed admin email (`email_verified: false`) -> `PERMISSION_DENIED`
4. Shadow field injection (`isAdmin: true`) on `/users/user1` -> `PERMISSION_DENIED`
5. UID spoofing (`uid: "otherUser"`) on `/users/user1/sync/state` -> `PERMISSION_DENIED`
6. Forged client timestamp (`createdAt` != `request.time`) -> `PERMISSION_DENIED`
7. Mutating `createdAt` during update of `/users/user1` -> `PERMISSION_DENIED`
8. Oversized note (`note.size() > 2000`) -> `PERMISSION_DENIED`
9. Invalid `khatmahCurrentPage` (`0` or `605`) -> `PERMISSION_DENIED`
10. Invalid `tafsirEdition` enum value -> `PERMISSION_DENIED`
11. Unbounded `khatmahCompletedJuz` array (`size > 30`) -> `PERMISSION_DENIED`
12. Cross-user `list` query on `/users/otherUser/bookmarks` -> `PERMISSION_DENIED`
13. Unverified or unauthenticated user reading/creating `/companionRooms/{roomCode}` -> `PERMISSION_DENIED`
14. Third-party user attempting `get` on an active/occupied room (`guestUid != ""`) -> `PERMISSION_DENIED`
15. Global `list` query on `/companionRooms` without filtering `hostUid` or `guestUid` == caller -> `PERMISSION_DENIED`
16. Host forging or decrementing score or altering `guestScore` directly during active game -> `PERMISSION_DENIED`
17. Non-participant reading or posting into `/companionRooms/{roomCode}/messages` -> `PERMISSION_DENIED`
18. Attempting to edit or delete a sent message in `/companionRooms/{roomCode}/messages/{messageId}` -> `PERMISSION_DENIED`
19. Unauthenticated or unverified user reading/writing `/leaderboard/{userId}` -> `PERMISSION_DENIED`
20. User attempting to update another user's `/leaderboard/{otherUid}` document -> `PERMISSION_DENIED`
21. Attacker attempting to spike points by more than `250` in a single round or decrement `totalPoints`/`winsCount`/`roundsCount` -> `PERMISSION_DENIED`
22. Storing PII (`email`, `phone`) or shadow fields (`isAdmin`) on `/leaderboard/{userId}` -> `PERMISSION_DENIED`
23. Advancing `currentQuestionIndex` before both participants have submitted an answer for the current question -> `PERMISSION_DENIED`
24. Incrementing own score by more than `+25` in a single live question update on `/companionRooms/{roomCode}` -> `PERMISSION_DENIED`
25. Writing another user's `/users/{otherUid}/sync/streak` or forging `uid` / `updatedAt` / shadow fields -> `PERMISSION_DENIED`
26. Injecting oversized `recentActiveDates` (`size > 35`) or negative `currentStreak` / `totalStreakPoints` on `/users/{userId}/sync/streak` -> `PERMISSION_DENIED`
27. Global `list` query on `/groupKhatmahs` without filtering for caller's UID in `memberUids` or `creatorUid` -> `PERMISSION_DENIED`
28. Non-member reading or writing `/groupKhatmahs/{groupCode}/members/{memberId}` -> `PERMISSION_DENIED`
29. User attempting to update another member's `/groupKhatmahs/{groupCode}/members/{otherUid}` progress (`completedJuz`/`currentPage`) -> `PERMISSION_DENIED`
30. Injecting unbounded `memberUids` (`size > 50`), invalid `currentPage` (`0` or `605`), or `completedJuz` (`size > 30`) -> `PERMISSION_DENIED`
31. Cross-user read/write/list on `/users/{otherUid}/khatmahs` or `/users/{otherUid}/khatmahs/{khatmahId}` -> `PERMISSION_DENIED`
32. Creating a PersonalKhatmah with invalid `currentPage` (`0`/`605`), `targetDays` (`0`/`366`), oversized `name` (`> 80`), or mismatched `uid`/`id` -> `PERMISSION_DENIED`
33. Cross-user read/write on `/users/{otherUid}/sync/hifz` or forging `uid` / `updatedAt` / shadow fields -> `PERMISSION_DENIED`
34. Writing invalid `bestScorePct` (`> 100`), oversized `testedSurahs` (`> 114`), or oversized `testedJuzs` (`> 30`) on `/users/{userId}/sync/hifz` -> `PERMISSION_DENIED`

