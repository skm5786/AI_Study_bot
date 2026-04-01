# Data Flow Diagram (High Level)

```mermaid
flowchart LR
  U[User] --> F[React + Vite Frontend]
  F -->|POST /api/uploads| B[Express Backend]
  B -->|Store metadata| D[(SQLite DB)]
  B -->|Store file bytes| S[(Local Uploads Directory)]
  B -->|Return share URL| F
  F -->|Share URL| U

  U -->|Open shared link| F
  F -->|GET /api/content/:token| B
  B -->|Validate token + expiry| D
  B -->|If text return payload| F
  B -->|If file stream download| U

  C[Cron-like Interval Cleanup] --> B
  B -->|Find expired records| D
  B -->|Delete expired metadata| D
  B -->|Delete expired files| S
```

## Notes
- Access is strictly link-based. No listing APIs are exposed.
- If token is invalid or expired, backend returns `403`.
- Default expiry is 10 minutes if user does not provide expiry.
