
CREATE POLICY "Users update own runs" ON public.analysis_runs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM contracts c WHERE c.id = analysis_runs.contract_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM contracts c WHERE c.id = analysis_runs.contract_id AND c.user_id = auth.uid()));

CREATE POLICY "Users write own extractions" ON public.extractions FOR ALL
  USING (EXISTS (SELECT 1 FROM contracts c WHERE c.id = extractions.contract_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM contracts c WHERE c.id = extractions.contract_id AND c.user_id = auth.uid()));

CREATE POLICY "Users write own risks" ON public.risks FOR ALL
  USING (EXISTS (SELECT 1 FROM contracts c WHERE c.id = risks.contract_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM contracts c WHERE c.id = risks.contract_id AND c.user_id = auth.uid()));

CREATE POLICY "Users write own synthesis" ON public.synthesis FOR ALL
  USING (EXISTS (SELECT 1 FROM contracts c WHERE c.id = synthesis.contract_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM contracts c WHERE c.id = synthesis.contract_id AND c.user_id = auth.uid()));

-- Reset stuck runs so the client can auto-retry.
DELETE FROM public.analysis_runs WHERE status = 'running' AND started_at < now() - interval '2 minutes';
UPDATE public.contracts SET status = 'pending' WHERE status IN ('analyzing','completed') AND id NOT IN (SELECT contract_id FROM public.synthesis);
