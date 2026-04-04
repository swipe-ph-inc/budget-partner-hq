import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const MCP_TOOLS: Tool[] = [
  {
    name: "get_accounts",
    description: "List all financial accounts with current balances. Returns savings, checking, e-wallet, and cash accounts.",
    input_schema: {
      type: "object",
      properties: {
        include_inactive: {
          type: "boolean",
          description: "Include archived/inactive accounts. Default false.",
        },
      },
    },
  },
  {
    name: "get_account_balance",
    description: "Get the current balance for a specific account by ID or name.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "Account UUID" },
        account_name: { type: "string", description: "Account name (partial match)" },
      },
    },
  },
  {
    name: "get_transactions",
    description: "Query transactions with filters. Supports date range, type, account, category, and amount filters.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "ISO date YYYY-MM-DD" },
        end_date: { type: "string", description: "ISO date YYYY-MM-DD" },
        type: {
          type: "string",
          enum: ["income", "expense", "transfer", "credit_payment", "credit_charge"],
        },
        account_id: { type: "string" },
        category_id: { type: "string" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "create_transaction",
    description: "Add a new transaction. For transfers, creates two linked transactions automatically.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["income", "expense", "transfer", "credit_payment", "credit_charge"],
          description: "Transaction type",
        },
        amount: { type: "number", description: "Transaction amount (positive)" },
        date: { type: "string", description: "ISO date YYYY-MM-DD" },
        currency_code: { type: "string", description: "Currency code e.g. PHP" },
        description: { type: "string" },
        income_type: {
          type: "string",
          enum: ["salary", "freelance", "other"],
          description: "Required when type is income",
        },
        is_collected: {
          type: "boolean",
          description: "For freelance income: has this been received? Default true.",
        },
        from_account_id: { type: "string", description: "Source account (for expense/transfer)" },
        to_account_id: { type: "string", description: "Destination account (for transfer/income)" },
        credit_card_id: { type: "string", description: "For credit charges/payments" },
        category_id: { type: "string" },
        merchant_id: { type: "string" },
        fee_amount: { type: "number", description: "Processing/transfer fee" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["type", "amount", "date", "currency_code"],
    },
  },
  {
    name: "get_expenses",
    description: "Query logged expenses with filters.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
        category_id: { type: "string" },
        merchant_id: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "create_expense",
    description: "Log a new expense record.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "ISO date YYYY-MM-DD" },
        amount: { type: "number" },
        currency_code: { type: "string" },
        category_id: { type: "string" },
        merchant_id: { type: "string" },
        account_id: { type: "string" },
        credit_card_id: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["date", "amount", "currency_code"],
    },
  },
  {
    name: "get_credit_cards",
    description: "List all credit cards with outstanding balance, credit limit, and utilisation percentage.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_credit_card_statements",
    description: "Get statement history for a specific credit card.",
    input_schema: {
      type: "object",
      properties: {
        credit_card_id: { type: "string", description: "Credit card UUID" },
        limit: { type: "number", description: "Number of statements (default 6)" },
      },
      required: ["credit_card_id"],
    },
  },
  {
    name: "get_savings_plans",
    description: "List all savings goals with current progress, target amount, and projected completion date.",
    input_schema: {
      type: "object",
      properties: {
        include_achieved: { type: "boolean" },
      },
    },
  },
  {
    name: "add_savings_contribution",
    description: "Add a contribution to a savings plan.",
    input_schema: {
      type: "object",
      properties: {
        savings_plan_id: { type: "string" },
        amount: { type: "number" },
        date: { type: "string" },
        notes: { type: "string" },
      },
      required: ["savings_plan_id", "amount", "date"],
    },
  },
  {
    name: "get_invoices",
    description: "List invoices with optional status filter.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "sent", "partial", "paid", "overdue", "cancelled"],
        },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "update_invoice_status",
    description: "Change the status of an invoice.",
    input_schema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        status: {
          type: "string",
          enum: ["draft", "sent", "partial", "paid", "overdue", "cancelled"],
        },
        paid_amount: { type: "number", description: "For partial payments" },
      },
      required: ["invoice_id", "status"],
    },
  },
  {
    name: "get_categories",
    description: "List all expense/income categories.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["income", "expense", "both"] },
      },
    },
  },
  {
    name: "get_merchants",
    description: "List all saved merchants.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Fuzzy search by name" },
      },
    },
  },
  {
    name: "get_dashboard_summary",
    description: "Return a complete financial snapshot: account balances, card utilisation, recent transactions, upcoming due dates, and health metrics.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_upcoming_due_dates",
    description: "Return credit card and debt payment due dates within the next N days.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Look-ahead window in days (default 30)" },
      },
    },
  },
  {
    name: "get_spending_by_category",
    description: "Return aggregated spend grouped by category for a date range.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_financial_health_snapshot",
    description: "Get current financial health metrics: buffer months, DTI ratio, credit utilisation, net worth, safe-to-spend.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_monthly_allocation",
    description: "Get the active allocation plan for the current month, including obligations, goals, and safe-to-spend.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "ISO date of month start YYYY-MM-01. Defaults to current month." },
      },
    },
  },
  {
    name: "approve_allocation",
    description: "Approve or adjust the current month's allocation plan.",
    input_schema: {
      type: "object",
      properties: {
        allocation_id: { type: "string" },
        adjustments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item_id: { type: "string" },
              new_amount: { type: "number" },
            },
            required: ["item_id", "new_amount"],
          },
          description: "Optional array of item adjustments before approving",
        },
      },
      required: ["allocation_id"],
    },
  },
  {
    name: "get_safe_to_spend",
    description: "Get real-time remaining spending budget for the current month.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_debt_strategy",
    description: "Get the active debt repayment strategy with month-by-month payment schedule.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "run_strategy_recommendation",
    description: "Trigger a fresh debt strategy evaluation and return the new recommendation with reasoning.",
    input_schema: {
      type: "object",
      properties: {
        extra_monthly_payment: {
          type: "number",
          description: "Amount available above minimum payments each month",
        },
      },
    },
  },
  {
    name: "get_month_in_review",
    description: "Get end-of-month financial digest for a given month.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "ISO date YYYY-MM-01" },
      },
    },
  },
  {
    name: "get_income_averages",
    description: "Get rolling 3-month averages for salary and freelance income.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_windfall_recommendation",
    description: "Generate a windfall allocation recommendation for a given amount of freelance income.",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Windfall amount" },
        currency_code: { type: "string" },
      },
      required: ["amount"],
    },
  },
  {
    name: "get_subscriptions",
    description: "List all subscriptions with billing dates and amounts.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "paused", "cancelled"] },
      },
    },
  },
  {
    name: "get_debts",
    description: "List all debts in the unified debt ledger (credit cards, instalments, loans, informal debts).",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "paid_off", "paused"] },
      },
    },
  },

  // ── CREATE tools ──────────────────────────────────────────────────────────

  {
    name: "create_account",
    description: "Create a new financial account (savings, checking, e-wallet, or cash).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Account name e.g. 'BDO Savings'" },
        type: {
          type: "string",
          enum: ["savings", "checking", "ewallet", "cash"],
          description: "Account type",
        },
        currency_code: { type: "string", description: "Currency code e.g. PHP" },
        institution: { type: "string", description: "Bank or provider name" },
        initial_balance: { type: "number", description: "Starting balance. Defaults to 0." },
        color: { type: "string", description: "Hex color for the account card" },
        notes: { type: "string" },
      },
      required: ["name", "type", "currency_code"],
    },
  },

  {
    name: "create_category",
    description: "Create a new expense or income category.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Category name e.g. 'Groceries'" },
        type: {
          type: "string",
          enum: ["income", "expense", "both"],
          description: "Category type. Defaults to expense.",
        },
        color: { type: "string", description: "Hex color code e.g. #e74c3c" },
        icon: { type: "string", description: "Icon identifier" },
        budget_amount: { type: "number", description: "Optional monthly budget for this category" },
        is_survival: { type: "boolean", description: "Mark as survival/essential expense. Default false." },
      },
      required: ["name"],
    },
  },

  {
    name: "create_merchant",
    description: "Create a new merchant record so it can be linked to transactions and expenses.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Merchant name e.g. 'Jollibee'" },
        category_id: { type: "string", description: "Default category UUID for this merchant" },
        notes: { type: "string" },
      },
      required: ["name"],
    },
  },

  {
    name: "create_subscription",
    description: "Add a recurring subscription to track (Netflix, Spotify, gym, etc.).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Subscription name e.g. 'Netflix'" },
        provider: { type: "string", description: "Provider/brand name" },
        amount: { type: "number", description: "Billing amount" },
        currency_code: { type: "string", description: "Currency code e.g. PHP" },
        billing_cycle: {
          type: "string",
          enum: ["weekly", "monthly", "quarterly", "yearly"],
        },
        next_billing_date: { type: "string", description: "ISO date YYYY-MM-DD of the next charge" },
        payment_method_type: {
          type: "string",
          enum: ["credit_card", "account"],
        },
        credit_card_id: { type: "string", description: "Credit card UUID if paid by card" },
        account_id: { type: "string", description: "Account UUID if paid by account" },
        category_id: { type: "string" },
        auto_log_transaction: {
          type: "boolean",
          description: "Auto-create a transaction on billing date. Default true.",
        },
        notes: { type: "string" },
      },
      required: ["name", "amount", "currency_code", "billing_cycle", "next_billing_date", "payment_method_type"],
    },
  },

  {
    name: "create_debt",
    description: "Add a new debt to track — personal loan, government loan, informal, or other.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Debt name e.g. 'SSS Salary Loan'" },
        type: {
          type: "string",
          enum: ["personal_loan", "government_loan", "informal", "other"],
        },
        original_amount: { type: "number", description: "Original principal amount" },
        current_balance: { type: "number", description: "Remaining balance to pay" },
        currency_code: { type: "string", description: "Currency code e.g. PHP" },
        interest_rate: { type: "number", description: "Annual interest rate as decimal e.g. 0.12 for 12%" },
        monthly_payment: { type: "number", description: "Required monthly payment amount" },
        payment_due_day: { type: "number", description: "Day of month payment is due (1-28)" },
        lender_name: { type: "string", description: "Name of lender or person owed" },
        start_date: { type: "string", description: "ISO date YYYY-MM-DD when debt started" },
        expected_end_date: { type: "string", description: "ISO date YYYY-MM-DD expected payoff date" },
        notes: { type: "string" },
      },
      required: ["name", "type", "original_amount", "current_balance", "currency_code"],
    },
  },

  {
    name: "create_savings_plan",
    description: "Create a new savings goal (emergency fund, vacation, gadget, down payment, etc.).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Goal name e.g. 'Emergency Fund'" },
        target_amount: { type: "number", description: "Target amount to save" },
        currency_code: { type: "string", description: "Currency code e.g. PHP" },
        target_date: { type: "string", description: "ISO date YYYY-MM-DD target completion date" },
        linked_account_id: { type: "string", description: "Account UUID where savings are held" },
        initial_amount: { type: "number", description: "Amount already saved. Defaults to 0." },
        color: { type: "string", description: "Hex color for the goal card" },
        icon: { type: "string", description: "Icon identifier" },
      },
      required: ["name", "target_amount", "currency_code"],
    },
  },

  {
    name: "create_invoice",
    description: "Create a new invoice for a client with line items.",
    input_schema: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "Client or company name" },
        client_email: { type: "string" },
        client_address: { type: "string" },
        invoice_number: { type: "string", description: "Invoice number e.g. INV-001. Auto-generated if omitted." },
        issue_date: { type: "string", description: "ISO date YYYY-MM-DD. Defaults to today." },
        due_date: { type: "string", description: "ISO date YYYY-MM-DD payment due date" },
        currency_code: { type: "string", description: "Currency code e.g. PHP" },
        tax_rate: { type: "number", description: "Tax rate as decimal e.g. 0.12 for 12% VAT. Default 0." },
        discount_amount: { type: "number", description: "Flat discount amount. Default 0." },
        notes: { type: "string" },
        line_items: {
          type: "array",
          description: "Invoice line items",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" },
            },
            required: ["description", "quantity", "unit_price"],
          },
        },
      },
      required: ["client_name", "due_date", "currency_code", "line_items"],
    },
  },
];
