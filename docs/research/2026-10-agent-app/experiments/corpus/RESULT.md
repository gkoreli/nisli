# corpus

Date: 2026-10-20, America/Los_Angeles. Source: `4afde49c728a330e10ce887a38b8013d63b58498`. Node v22.23.2; pnpm 10.17.1; Vitest 2.1.9 where used.

## Command

Run from repository root:

```sh
node docs/research/2026-10-agent-app/experiments/corpus/run.mjs
```

## Verdict

PASS: reproducible AST census. 10 production screen modules, 1,397 lines, 27 signal declarations. Counts are syntax occurrences, not proposed deletions, bugs, or measured productivity gains. Test files are excluded. Full per-file callsite evidence follows.

Exit status: **0**.

## Full output

```json
{
  "scope": "Ledger screens only; syntax counts, not savings or independent bugs",
  "files": 10,
  "lines": 1397,
  "counts": {
    "Dialog": 7,
    "Form": 10,
    "notify": 23,
    "confirm": 6,
    "query": 4,
    "flushNow": 6,
    "reloadFromServer": 4,
    "refetch": 11
  },
  "signalDeclarations": 27,
  "screens": [
    {
      "file": "packages/ledger/src/screens/account.ts",
      "lines": 44,
      "calls": [],
      "signals": [
        {
          "name": "editing",
          "line": 14
        },
        {
          "name": "open",
          "line": 15
        }
      ],
      "rules": []
    },
    {
      "file": "packages/ledger/src/screens/accounts.ts",
      "lines": 73,
      "calls": [
        {
          "kind": "Dialog",
          "line": 59
        },
        {
          "kind": "Form",
          "line": 64
        }
      ],
      "signals": [
        {
          "name": "adding",
          "line": 14
        },
        {
          "name": "opens",
          "line": 15
        }
      ],
      "rules": [
        {
          "kind": "options",
          "line": 19,
          "executable": false
        },
        {
          "kind": "validate",
          "line": 22,
          "executable": true
        }
      ]
    },
    {
      "file": "packages/ledger/src/screens/budgets.ts",
      "lines": 75,
      "calls": [
        {
          "kind": "Dialog",
          "line": 55
        },
        {
          "kind": "Form",
          "line": 59
        },
        {
          "kind": "notify",
          "line": 63
        },
        {
          "kind": "confirm",
          "line": 67
        },
        {
          "kind": "notify",
          "line": 68
        }
      ],
      "signals": [
        {
          "name": "editing",
          "line": 11
        },
        {
          "name": "open",
          "line": 12
        },
        {
          "name": "opens",
          "line": 13
        }
      ],
      "rules": [
        {
          "kind": "options",
          "line": 26,
          "executable": false
        }
      ]
    },
    {
      "file": "packages/ledger/src/screens/connections.ts",
      "lines": 241,
      "calls": [
        {
          "kind": "query",
          "line": 29
        },
        {
          "kind": "query",
          "line": 30
        },
        {
          "kind": "query",
          "line": 31
        },
        {
          "kind": "flushNow",
          "line": 40
        },
        {
          "kind": "reloadFromServer",
          "line": 42
        },
        {
          "kind": "refetch",
          "line": 45
        },
        {
          "kind": "refetch",
          "line": 45
        },
        {
          "kind": "refetch",
          "line": 59
        },
        {
          "kind": "flushNow",
          "line": 62
        },
        {
          "kind": "reloadFromServer",
          "line": 64
        },
        {
          "kind": "refetch",
          "line": 65
        },
        {
          "kind": "refetch",
          "line": 65
        },
        {
          "kind": "notify",
          "line": 66
        },
        {
          "kind": "notify",
          "line": 89
        },
        {
          "kind": "notify",
          "line": 97
        },
        {
          "kind": "flushNow",
          "line": 103
        },
        {
          "kind": "reloadFromServer",
          "line": 105
        },
        {
          "kind": "refetch",
          "line": 106
        },
        {
          "kind": "refetch",
          "line": 106
        },
        {
          "kind": "notify",
          "line": 109
        },
        {
          "kind": "confirm",
          "line": 114
        },
        {
          "kind": "flushNow",
          "line": 119
        },
        {
          "kind": "reloadFromServer",
          "line": 121
        },
        {
          "kind": "refetch",
          "line": 122
        },
        {
          "kind": "refetch",
          "line": 123
        },
        {
          "kind": "notify",
          "line": 124
        },
        {
          "kind": "Dialog",
          "line": 198
        },
        {
          "kind": "notify",
          "line": 219
        },
        {
          "kind": "confirm",
          "line": 228
        },
        {
          "kind": "flushNow",
          "line": 229
        },
        {
          "kind": "refetch",
          "line": 231
        },
        {
          "kind": "refetch",
          "line": 231
        },
        {
          "kind": "notify",
          "line": 232
        }
      ],
      "signals": [
        {
          "name": "selected",
          "line": 34
        },
        {
          "name": "open",
          "line": 35
        }
      ],
      "rules": []
    },
    {
      "file": "packages/ledger/src/screens/import.ts",
      "lines": 170,
      "calls": [
        {
          "kind": "notify",
          "line": 118
        },
        {
          "kind": "Form",
          "line": 128
        },
        {
          "kind": "Form",
          "line": 148
        }
      ],
      "signals": [
        {
          "name": "fileKey",
          "line": 41
        },
        {
          "name": "accountId",
          "line": 42
        },
        {
          "name": "rows",
          "line": 43
        },
        {
          "name": "mapping",
          "line": 44
        }
      ],
      "rules": [
        {
          "kind": "options",
          "line": 59,
          "executable": false
        },
        {
          "kind": "options",
          "line": 66,
          "executable": false
        },
        {
          "kind": "validate",
          "line": 66,
          "executable": false
        },
        {
          "kind": "options",
          "line": 67,
          "executable": false
        },
        {
          "kind": "options",
          "line": 68,
          "executable": false
        },
        {
          "kind": "validate",
          "line": 68,
          "executable": false
        },
        {
          "kind": "options",
          "line": 69,
          "executable": false
        },
        {
          "kind": "options",
          "line": 70,
          "executable": false
        },
        {
          "kind": "when",
          "line": 70,
          "executable": false
        },
        {
          "kind": "validate",
          "line": 70,
          "executable": false
        },
        {
          "kind": "options",
          "line": 71,
          "executable": false
        },
        {
          "kind": "when",
          "line": 71,
          "executable": false
        },
        {
          "kind": "validate",
          "line": 71,
          "executable": false
        },
        {
          "kind": "options",
          "line": 72,
          "executable": false
        },
        {
          "kind": "when",
          "line": 72,
          "executable": false
        },
        {
          "kind": "validate",
          "line": 72,
          "executable": false
        },
        {
          "kind": "options",
          "line": 73,
          "executable": false
        },
        {
          "kind": "when",
          "line": 75,
          "executable": false
        }
      ]
    },
    {
      "file": "packages/ledger/src/screens/overview.ts",
      "lines": 275,
      "calls": [],
      "signals": [],
      "rules": []
    },
    {
      "file": "packages/ledger/src/screens/rules.ts",
      "lines": 148,
      "calls": [
        {
          "kind": "notify",
          "line": 58
        },
        {
          "kind": "Dialog",
          "line": 95
        },
        {
          "kind": "Form",
          "line": 100
        },
        {
          "kind": "notify",
          "line": 107
        },
        {
          "kind": "confirm",
          "line": 116
        },
        {
          "kind": "notify",
          "line": 120
        },
        {
          "kind": "Dialog",
          "line": 127
        },
        {
          "kind": "Form",
          "line": 132
        },
        {
          "kind": "notify",
          "line": 139
        }
      ],
      "signals": [
        {
          "name": "editing",
          "line": 13
        },
        {
          "name": "ruleOpen",
          "line": 14
        },
        {
          "name": "ruleOpens",
          "line": 15
        },
        {
          "name": "prefill",
          "line": 16
        },
        {
          "name": "categoryOpen",
          "line": 17
        },
        {
          "name": "categoryOpens",
          "line": 18
        }
      ],
      "rules": [
        {
          "kind": "options",
          "line": 43,
          "executable": false
        }
      ]
    },
    {
      "file": "packages/ledger/src/screens/settings.ts",
      "lines": 138,
      "calls": [
        {
          "kind": "query",
          "line": 48
        },
        {
          "kind": "flushNow",
          "line": 57
        },
        {
          "kind": "notify",
          "line": 61
        },
        {
          "kind": "notify",
          "line": 63
        },
        {
          "kind": "notify",
          "line": 77
        },
        {
          "kind": "notify",
          "line": 85
        },
        {
          "kind": "notify",
          "line": 87
        },
        {
          "kind": "Form",
          "line": 101
        },
        {
          "kind": "notify",
          "line": 101
        },
        {
          "kind": "confirm",
          "line": 115
        },
        {
          "kind": "Dialog",
          "line": 128
        },
        {
          "kind": "Form",
          "line": 133
        }
      ],
      "signals": [
        {
          "name": "draft",
          "line": 39
        },
        {
          "name": "importing",
          "line": 40
        },
        {
          "name": "backup",
          "line": 41
        }
      ],
      "rules": [
        {
          "kind": "options",
          "line": 44,
          "executable": false
        },
        {
          "kind": "options",
          "line": 45,
          "executable": false
        },
        {
          "kind": "options",
          "line": 46,
          "executable": false
        }
      ]
    },
    {
      "file": "packages/ledger/src/screens/transaction-dialog.ts",
      "lines": 121,
      "calls": [
        {
          "kind": "notify",
          "line": 83
        },
        {
          "kind": "Dialog",
          "line": 86
        },
        {
          "kind": "Form",
          "line": 98
        },
        {
          "kind": "confirm",
          "line": 108
        },
        {
          "kind": "notify",
          "line": 109
        },
        {
          "kind": "notify",
          "line": 115
        }
      ],
      "signals": [
        {
          "name": "opens",
          "line": 41
        }
      ],
      "rules": [
        {
          "kind": "readOnly",
          "line": 49,
          "executable": false
        },
        {
          "kind": "readOnly",
          "line": 50,
          "executable": false
        },
        {
          "kind": "options",
          "line": 50,
          "executable": false
        },
        {
          "kind": "readOnly",
          "line": 51,
          "executable": false
        },
        {
          "kind": "readOnly",
          "line": 52,
          "executable": false
        },
        {
          "kind": "readOnly",
          "line": 53,
          "executable": false
        },
        {
          "kind": "options",
          "line": 53,
          "executable": false
        },
        {
          "kind": "options",
          "line": 56,
          "executable": true
        }
      ]
    },
    {
      "file": "packages/ledger/src/screens/transactions.ts",
      "lines": 112,
      "calls": [
        {
          "kind": "Form",
          "line": 87
        }
      ],
      "signals": [
        {
          "name": "filters",
          "line": 32
        },
        {
          "name": "sort",
          "line": 33
        },
        {
          "name": "editing",
          "line": 34
        },
        {
          "name": "open",
          "line": 35
        }
      ],
      "rules": [
        {
          "kind": "options",
          "line": 39,
          "executable": false
        },
        {
          "kind": "options",
          "line": 40,
          "executable": false
        },
        {
          "kind": "options",
          "line": 41,
          "executable": false
        }
      ]
    }
  ]
}

```
