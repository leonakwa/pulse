# PulseHive test plan

Use **two normal accounts** (A and B, B more than 24 hours old) and **your admin account**. Test on a phone and on a computer.
Tick each line. Write down anything that fails with: what you did, what you expected, what happened (a screenshot helps).

## 1. Accounts
- [ ] Register with a new email. The confirmation email arrives (check spam). The link opens PulseHive, not a Vercel login page.
- [ ] Register again with the same email: clear "already exists" message. Same username: "already taken".
- [ ] Wrong password shows a clear error. Show/Hide password works.
- [ ] Forgot password: email arrives, link works, new password works.
- [ ] Close the browser and reopen: still signed in. Sign out from Settings: signed out. A signed-out visitor opening /feed goes to the sign-in page.
- [ ] Resend confirmation email page works.

## 2. Profile and photos
- [ ] Edit name, username, bio, location: saved after refresh. A taken username is refused.
- [ ] Upload profile picture and cover photo: appear on profile and posts. Remove works. A very large photo (5 MB+) uploads. A non-image file is refused.

## 3. Posts and feed
- [ ] Post text only, photo only, text with 4 photos. A 5th photo is refused. 501 characters is refused.
- [ ] Posts survive a refresh. Edit shows "edited". Delete removes the post and photos.
- [ ] Following tab shows people you follow plus yourself. Discover shows everyone. A brand-new account lands on Discover.
- [ ] Scroll to the bottom: more posts load. Switching tabs keeps things correct.
- [ ] Turn off the internet mid-upload: you get an error and no half-saved post appears.

## 4. Likes, comments, follows
- [ ] Like and unlike: count changes and survives a refresh. Cannot like twice.
- [ ] Comment, delete own comment, count changes. A 301-character comment is refused.
- [ ] Follow and unfollow from a profile, from search, from the followers list. Counts update. You cannot follow yourself.

## 5. Discover and search
- [ ] Search by name and by username (part of it). One letter asks for more. Nonsense shows "No one found".
- [ ] Suggestions and popular posts show something useful for a new account.
- [ ] Turn "Show me in search" off in Settings > Privacy: you disappear from search and suggestions.

## 6. Messages
- [ ] A messages B: B sees the chat appear and the badge update without refreshing. Reply works both ways. History survives sign-out.
- [ ] Set B to "No one" (Settings > Privacy): A can no longer message B. "People I follow" works too.
- [ ] A third account cannot open the A-B conversation link.

## 7. Notifications
- [ ] Follow, like, comment, share, message and level-up each create a notification with the right person, text and link.
- [ ] Undo the like or follow: the notification disappears. Your own actions never notify you.
- [ ] Mark one read, mark all read: bell count updates. Turn a type off in Settings: no new ones of that type.

## 8. XP, levels, leaderboard
- [ ] Posting earns XP; XP history shows it. The daily limit stops extra XP (post 4+ times in a day).
- [ ] Likes/comments/follows from account B (over 24 hours old) earn XP for A. Your own likes and comments earn nothing.
- [ ] Unlike and like again: no extra XP.
- [ ] Progress bars on the XP page match your posts and followers. The leaderboard lists you; opting out hides you.

## 9. Sharing
- [ ] Share a post with a comment, undo it, copy the link, use "Share via". You cannot share your own post or the same post twice.
- [ ] Delete the original: the share says "no longer available".

## 10. Settings and privacy
- [ ] Light, Dark, Device default: stays after closing and reopening, and on a second device after signing in. Check text is readable in dark mode.
- [ ] Notification and privacy switches survive a refresh. Change password (wrong current password refused). Change email sends a confirmation.
- [ ] Download my data gives a file with your information. The Privacy Policy opens while signed out.
- [ ] Delete a throwaway account: it is gone, its posts disappear, and you can register with that email again.

## 11. Admin (admin account only)
- [ ] /admin opens for you and shows "not found" for A and B. The link is only visible to you.
- [ ] Overview numbers look right. Search users. Open a user. Suspend a throwaway account: it cannot sign in or use the app. Reactivate it.
- [ ] Delete a post with a reason: it disappears and appears in the Activity log. You cannot suspend yourself.

## 12. Look and feel
- [ ] Every screen works at phone width and on a wide screen. No sideways scrolling. Buttons are easy to tap.
- [ ] Loading shows placeholders, empty screens have a friendly message, errors are readable.
