
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- contracts
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contracts" ON public.contracts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- analysis_runs
CREATE TABLE public.analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  current_agent TEXT,
  agent_states JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_runs TO authenticated;
GRANT ALL ON public.analysis_runs TO service_role;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own runs" ON public.analysis_runs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND c.user_id = auth.uid())
);
CREATE POLICY "Users create own runs" ON public.analysis_runs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND c.user_id = auth.uid())
);

-- extractions
CREATE TABLE public.extractions (
  contract_id UUID PRIMARY KEY REFERENCES public.contracts(id) ON DELETE CASCADE,
  parties JSONB, dates JSONB, payment JSONB, obligations JSONB,
  confidentiality JSONB, termination JSONB, renewal JSONB, penalties JSONB,
  confidence NUMERIC, missing_fields JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extractions TO authenticated;
GRANT ALL ON public.extractions TO service_role;
ALTER TABLE public.extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own extractions" ON public.extractions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND c.user_id = auth.uid())
);

-- risks
CREATE TABLE public.risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  clause_text TEXT,
  explanation TEXT,
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risks TO authenticated;
GRANT ALL ON public.risks TO service_role;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own risks" ON public.risks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND c.user_id = auth.uid())
);

-- synthesis
CREATE TABLE public.synthesis (
  contract_id UUID PRIMARY KEY REFERENCES public.contracts(id) ON DELETE CASCADE,
  summary TEXT, key_insights JSONB, recommendations JSONB, action_items JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.synthesis TO authenticated;
GRANT ALL ON public.synthesis TO service_role;
ALTER TABLE public.synthesis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own synthesis" ON public.synthesis FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_id AND c.user_id = auth.uid())
);

-- chat_messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  citations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own chat" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own chat" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage policies for contracts bucket (private, user-scoped by folder = user_id)
CREATE POLICY "Users read own contract files" ON storage.objects FOR SELECT
  USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own contract files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own contract files" ON storage.objects FOR DELETE
  USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);
