# Security Specification & Threat Model (TDD SPEC)

## Data Invariants
1. **User Identity Invariant**: A user profile document `/users/{userId}` can only be created and updated by the user whose authenticated `request.auth.uid` matches the `userId`.
2. **UniqueID Integrity**: The `uniqueID` field must match the regex pattern `^user_[a-zA-Z0-9_\-]+$`.
3. **Friend Request Ownership**: A friend request can only be sent by the authenticated user (`senderId == request.auth.uid`), and can only be accepted/declined by the intended receiver (`receiverId == request.auth.uid`).
4. **Chat Membership Invariant**: A user can only access a chat `/chats/{chatId}` and its subcollection `/chats/{chatId}/messages/{messageId}` if their `request.auth.uid` is included in the chat's `participants` list.

## The Dirty Dozen (Threat Vectors & Forbidden Payloads)

1. **Identity Spoofing on User Creation**: Creating a profile for a different UID.
   - *Target*: `create` on `/users/attacker_uid` with body `{"uid": "victim_uid", "uniqueID": "user_1234", "status": "online"}`
   - *Expected*: `PERMISSION_DENIED`
2. **Ghost Field Injection on User Update**: Injecting arbitrary non-whitelisted admin fields.
   - *Target*: `update` on `/users/user_123` with body `{"uid": "user_123", "isAdmin": true, "uniqueID": "user_123", "status": "online"}`
   - *Expected*: `PERMISSION_DENIED`
3. **Friend Request Spoofing**: Sending a friend request on behalf of another user.
   - *Target*: `create` on `/friendRequests/req_abc` with body `{"requestId": "req_abc", "senderId": "victim_123", "receiverId": "target_456", "status": "pending", "timestamp": "request.time"}`
   - *Expected*: `PERMISSION_DENIED`
4. **Illegal Friend Request Status Interception**: Sender trying to accept their own request.
   - *Target*: `update` on `/friendRequests/req_abc` (where sender is attacker) with body `{"status": "accepted"}`
   - *Expected*: `PERMISSION_DENIED`
5. **Unauthorized Chat Snooping**: Reading chats the user is not a participant in.
   - *Target*: `get` on `/chats/chat_abc` (participants: `["user_1", "user_2"]`) by user `attacker_999`.
   - *Expected*: `PERMISSION_DENIED`
6. **Self-Inserting to Chats**: An attacker modifying a chat's participant list to add themselves.
   - *Target*: `update` on `/chats/chat_abc` by `attacker_999` to change participants to `["user_1", "user_2", "attacker_999"]`.
   - *Expected*: `PERMISSION_DENIED`
7. **Cross-Chat Message Poisoning**: Writing a message to a chat the user is not in.
   - *Target*: `create` on `/chats/chat_abc/messages/msg_1` by `attacker_999`.
   - *Expected*: `PERMISSION_DENIED`
8. **Impersonated Message Sending**: Sending a message inside a valid chat, but spoofing the `senderId`.
   - *Target*: `create` on `/chats/chat_abc/messages/msg_1` (where attacker is a participant) but with `senderId: "victim_123"`.
   - *Expected*: `PERMISSION_DENIED`
9. **Message Text Overflow Attack**: Sending a message exceeding `maxLength: 5000`.
   - *Target*: `create` on `/chats/chat_abc/messages/msg_1` with text length 10,000.
   - *Expected*: `PERMISSION_DENIED`
10. **Immutable Fields Modification**: Attempting to change `createdAt` or `senderId` in an existing message.
    - *Target*: `update` on `/chats/chat_abc/messages/msg_1` to change `senderId` or `timestamp`.
    - *Expected*: `PERMISSION_DENIED`
11. **Malicious Client Query Scrape**: Blanket reading all friend requests without checking participant fields.
    - *Target*: Querying `/friendRequests` without filters.
    - *Expected*: `PERMISSION_DENIED`
12. **Bypassing Verification**: Writing when `request.auth.token.email_verified` is not true (if required).
    - *Target*: Any write by user with unverified email.
    - *Expected*: `PERMISSION_DENIED`
