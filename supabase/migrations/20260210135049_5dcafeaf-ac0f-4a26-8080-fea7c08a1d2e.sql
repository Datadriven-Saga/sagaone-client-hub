
CREATE POLICY "Admins can update MFA accounts"
  ON public.mfa_accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_acesso IN ('Administrador'::tipo_acesso, 'TI'::tipo_acesso)
    )
  );
