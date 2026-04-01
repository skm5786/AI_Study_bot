# LinkVault Directory Structure

```text
linkvault/
├── .gitignore
├── README.md
├── docs/
│   ├── COMMIT_WORKFLOW.md
│   ├── DATA_FLOW_DIAGRAM.md
│   ├── DIRECTORY_STRUCTURE.md
│   └── GITHUB_SETUP.md
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── index.css
│       ├── main.jsx
│       ├── components/
│       │   ├── Alert.jsx
│       │   └── CopyButton.jsx
│       └── lib/
│           └── api.js
└── backend/
    ├── .env.example
    ├── package.json
    ├── sql/
    │   └── schema.sql
    └── src/
        ├── config.js
        ├── db.js
        ├── server.js
        ├── storage.js
        ├── data/
        │   └── .gitkeep
        ├── routes/
        │   ├── content.js
        │   └── uploads.js
        ├── services/
        │   └── cleanup.js
        ├── uploads/
        │   └── .gitkeep
        └── utils/
            └── id.js
```
