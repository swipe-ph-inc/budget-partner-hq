-- Per-user LLM provider + model overrides (null = use deployment / env defaults)

ALTER TABLE public.prompt_settings
  ADD COLUMN IF NOT EXISTS ai_provider TEXT
    CHECK (ai_provider IS NULL OR ai_provider IN ('openrouter', 'anthropic'));

ALTER TABLE public.prompt_settings
  ADD COLUMN IF NOT EXISTS ai_model TEXT;

COMMENT ON COLUMN public.prompt_settings.ai_provider IS 'NULL = use AI_PROVIDER env; otherwise which backend to use for this user.';
COMMENT ON COLUMN public.prompt_settings.ai_model IS 'NULL = use OPEN_ROUTER_MODEL / ANTHROPIC_MODEL env; otherwise full model id for that provider.';
