
-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Accounts
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  institution text,
  type text NOT NULL CHECK (type IN ('checking','savings','wallet')),
  color text NOT NULL DEFAULT '#0546DE',
  opening_balance_cents bigint NOT NULL DEFAULT 0,
  opening_date date NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.accounts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  icon text NOT NULL DEFAULT 'tag',
  color text NOT NULL DEFAULT '#64748B',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own categories" ON public.categories FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Cards
CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  limit_cents bigint NOT NULL CHECK (limit_cents > 0),
  closing_day int NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day int NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  color text NOT NULL DEFAULT '#0F172A',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cards" ON public.cards FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Recurrences
CREATE TABLE public.recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  description text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  category_id uuid,
  account_id uuid,
  payment_method text NOT NULL DEFAULT 'pix',
  day_of_month int NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  start_date date NOT NULL,
  end_date date,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  FOREIGN KEY (category_id, user_id) REFERENCES public.categories(id, user_id),
  FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurrences TO authenticated;
GRANT ALL ON public.recurrences TO service_role;
ALTER TABLE public.recurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recurrences" ON public.recurrences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Transactions (bank income/expense)
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  description text NOT NULL CHECK (length(trim(description)) > 0),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  category_id uuid NOT NULL,
  account_id uuid NOT NULL,
  payment_method text NOT NULL DEFAULT 'pix' CHECK (payment_method IN ('pix','cash','debit','credit','boleto','other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  competence_date date NOT NULL,
  due_date date NOT NULL,
  paid_date date,
  notes text,
  recurrence_id uuid,
  recurrence_seq int,
  client_key uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (category_id, user_id) REFERENCES public.categories(id, user_id),
  FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id),
  FOREIGN KEY (recurrence_id, user_id) REFERENCES public.recurrences(id, user_id) ON DELETE SET NULL (recurrence_id),
  UNIQUE (recurrence_id, recurrence_seq),
  UNIQUE (user_id, client_key),
  CHECK ((status = 'paid') = (paid_date IS NOT NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX ON public.transactions (user_id, due_date);

-- Transfers
CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  from_account_id uuid NOT NULL,
  to_account_id uuid NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  transfer_date date NOT NULL,
  description text,
  client_key uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (from_account_id, user_id) REFERENCES public.accounts(id, user_id),
  FOREIGN KEY (to_account_id, user_id) REFERENCES public.accounts(id, user_id),
  CHECK (from_account_id <> to_account_id),
  UNIQUE (user_id, client_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transfers" ON public.transfers FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  card_id uuid NOT NULL,
  closing_month date NOT NULL,
  closing_date date NOT NULL,
  due_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (card_id, user_id) REFERENCES public.cards(id, user_id) ON DELETE CASCADE,
  UNIQUE (card_id, closing_month),
  UNIQUE (id, user_id),
  CHECK (due_date > closing_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own invoices" ON public.invoices FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Card purchases (purchases and refunds)
CREATE TABLE public.card_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  card_id uuid NOT NULL,
  category_id uuid NOT NULL,
  description text NOT NULL CHECK (length(trim(description)) > 0),
  purchase_date date NOT NULL,
  total_cents bigint NOT NULL CHECK (total_cents > 0),
  installments int NOT NULL CHECK (installments BETWEEN 1 AND 48),
  kind text NOT NULL DEFAULT 'purchase' CHECK (kind IN ('purchase','refund')),
  refund_of uuid REFERENCES public.card_purchases(id) ON DELETE CASCADE,
  notes text,
  client_key uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (card_id, user_id) REFERENCES public.cards(id, user_id),
  FOREIGN KEY (category_id, user_id) REFERENCES public.categories(id, user_id),
  UNIQUE (id, user_id),
  UNIQUE (user_id, client_key),
  CHECK ((kind = 'refund') = (refund_of IS NOT NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_purchases TO authenticated;
GRANT ALL ON public.card_purchases TO service_role;
ALTER TABLE public.card_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own purchases select" ON public.card_purchases FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own purchases update" ON public.card_purchases FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own purchases delete" ON public.card_purchases FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Installments (signed amounts: refunds negative)
CREATE TABLE public.installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  purchase_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  number int NOT NULL,
  total_count int NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents <> 0),
  FOREIGN KEY (purchase_id, user_id) REFERENCES public.card_purchases(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id, user_id) REFERENCES public.invoices(id, user_id),
  UNIQUE (purchase_id, number)
);
GRANT SELECT ON public.installments TO authenticated;
GRANT ALL ON public.installments TO service_role;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own installments select" ON public.installments FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Invoice payments
CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  invoice_id uuid NOT NULL,
  account_id uuid NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  paid_date date NOT NULL,
  client_key uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (invoice_id, user_id) REFERENCES public.invoices(id, user_id),
  FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id),
  UNIQUE (user_id, client_key)
);
GRANT SELECT, DELETE ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments select" ON public.invoice_payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own payments delete" ON public.invoice_payments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Budgets
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  category_id uuid NOT NULL,
  month date NOT NULL CHECK (extract(day from month) = 1),
  limit_cents bigint NOT NULL CHECK (limit_cents > 0),
  FOREIGN KEY (category_id, user_id) REFERENCES public.categories(id, user_id) ON DELETE CASCADE,
  UNIQUE (user_id, category_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budgets" ON public.budgets FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Goals
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  target_cents bigint NOT NULL CHECK (target_cents > 0),
  deadline date,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.goals FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.goal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  goal_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('deposit','withdraw')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  entry_date date NOT NULL,
  note text,
  client_key uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (goal_id, user_id) REFERENCES public.goals(id, user_id) ON DELETE CASCADE,
  UNIQUE (user_id, client_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_entries TO authenticated;
GRANT ALL ON public.goal_entries TO service_role;
ALTER TABLE public.goal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goal entries" ON public.goal_entries FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== Helpers =====
CREATE OR REPLACE FUNCTION public.clamp_day(p_month date, p_day int) RETURNS date
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT date_trunc('month', p_month)::date
    + (LEAST(p_day, extract(day from (date_trunc('month', p_month) + interval '1 month - 1 day'))::int) - 1);
$$;

-- invoice dates for a closing month
CREATE OR REPLACE FUNCTION public.invoice_dates(p_closing_day int, p_due_day int, p_closing_month date,
  OUT closing_date date, OUT due_date date)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  closing_date := public.clamp_day(p_closing_month, p_closing_day);
  due_date := public.clamp_day(p_closing_month, p_due_day);
  IF due_date <= closing_date THEN
    due_date := public.clamp_day((date_trunc('month', p_closing_month) + interval '1 month')::date, p_due_day);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.today_br() RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

-- Opening date validation
CREATE OR REPLACE FUNCTION public.validate_opening_date() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_date date; v_acc uuid; v_open date;
BEGIN
  IF TG_TABLE_NAME = 'transactions' THEN
    IF NEW.status <> 'paid' THEN RETURN NEW; END IF;
    v_date := NEW.paid_date; v_acc := NEW.account_id;
  ELSIF TG_TABLE_NAME = 'invoice_payments' THEN
    v_date := NEW.paid_date; v_acc := NEW.account_id;
  ELSE
    v_date := NEW.transfer_date;
    SELECT opening_date INTO v_open FROM accounts WHERE id = NEW.to_account_id;
    IF v_date < v_open THEN RAISE EXCEPTION 'Data anterior ao saldo de abertura da conta de destino (%).', to_char(v_open,'DD/MM/YYYY'); END IF;
    v_acc := NEW.from_account_id;
  END IF;
  SELECT opening_date INTO v_open FROM accounts WHERE id = v_acc;
  IF v_date < v_open THEN
    RAISE EXCEPTION 'Data anterior ao saldo de abertura da conta (%).', to_char(v_open,'DD/MM/YYYY');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_tx_open BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.validate_opening_date();
CREATE TRIGGER trg_tr_open BEFORE INSERT OR UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.validate_opening_date();
CREATE TRIGGER trg_ip_open BEFORE INSERT OR UPDATE ON public.invoice_payments FOR EACH ROW EXECUTE FUNCTION public.validate_opening_date();

-- Prevent moving opening date after existing movements
CREATE OR REPLACE FUNCTION public.validate_account_opening_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.opening_date > OLD.opening_date AND (
    EXISTS (SELECT 1 FROM transactions WHERE account_id = NEW.id AND status='paid' AND paid_date < NEW.opening_date)
    OR EXISTS (SELECT 1 FROM transfers WHERE (from_account_id = NEW.id OR to_account_id = NEW.id) AND transfer_date < NEW.opening_date)
    OR EXISTS (SELECT 1 FROM invoice_payments WHERE account_id = NEW.id AND paid_date < NEW.opening_date)) THEN
    RAISE EXCEPTION 'Existem movimentações anteriores à nova data de abertura.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_acc_open BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.validate_account_opening_change();

-- Balances view
CREATE VIEW public.account_balances WITH (security_invoker = true) AS
SELECT a.id AS account_id, a.user_id,
  a.opening_balance_cents
  + COALESCE((SELECT sum(CASE WHEN t.kind='income' THEN t.amount_cents ELSE -t.amount_cents END) FROM transactions t WHERE t.account_id=a.id AND t.status='paid' AND t.paid_date <= public.today_br()),0)
  + COALESCE((SELECT sum(amount_cents) FROM transfers WHERE to_account_id=a.id AND transfer_date <= public.today_br()),0)
  - COALESCE((SELECT sum(amount_cents) FROM transfers WHERE from_account_id=a.id AND transfer_date <= public.today_br()),0)
  - COALESCE((SELECT sum(amount_cents) FROM invoice_payments WHERE account_id=a.id AND paid_date <= public.today_br()),0)
  AS balance_cents
FROM accounts a;
GRANT SELECT ON public.account_balances TO authenticated;

-- Ensure invoice exists (internal)
CREATE OR REPLACE FUNCTION public.ensure_invoice(p_card uuid, p_closing_month date) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_id uuid; v_card cards%ROWTYPE; d record;
BEGIN
  SELECT * INTO v_card FROM cards WHERE id = p_card AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Cartão não encontrado.'; END IF;
  SELECT id INTO v_id FROM invoices WHERE card_id = p_card AND closing_month = date_trunc('month', p_closing_month)::date;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT * INTO d FROM public.invoice_dates(v_card.closing_day, v_card.due_day, date_trunc('month', p_closing_month)::date);
  INSERT INTO invoices (user_id, card_id, closing_month, closing_date, due_date)
  VALUES (auth.uid(), p_card, date_trunc('month', p_closing_month)::date, d.closing_date, d.due_date)
  ON CONFLICT (card_id, closing_month) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM invoices WHERE card_id = p_card AND closing_month = date_trunc('month', p_closing_month)::date;
  END IF;
  RETURN v_id;
END $$;

-- Create purchase atomically (idempotent via client_key)
CREATE OR REPLACE FUNCTION public.create_card_purchase(
  p_card uuid, p_category uuid, p_description text, p_purchase_date date,
  p_total_cents bigint, p_installments int, p_first_closing_month date, p_notes text, p_client_key uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_id uuid; v_base bigint; v_rem bigint; i int; v_inv uuid; v_amt bigint; v_cat categories%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF p_client_key IS NOT NULL THEN
    SELECT id INTO v_id FROM card_purchases WHERE user_id = auth.uid() AND client_key = p_client_key;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  IF p_total_cents IS NULL OR p_total_cents <= 0 THEN RAISE EXCEPTION 'Valor deve ser positivo.'; END IF;
  IF p_installments IS NULL OR p_installments < 1 OR p_installments > 48 THEN RAISE EXCEPTION 'Parcelas inválidas (1 a 48).'; END IF;
  IF p_total_cents < p_installments THEN RAISE EXCEPTION 'Valor insuficiente para a quantidade de parcelas.'; END IF;
  SELECT * INTO v_cat FROM categories WHERE id = p_category AND user_id = auth.uid();
  IF NOT FOUND OR v_cat.kind <> 'expense' THEN RAISE EXCEPTION 'Categoria de despesa inválida.'; END IF;
  INSERT INTO card_purchases (user_id, card_id, category_id, description, purchase_date, total_cents, installments, notes, client_key)
  VALUES (auth.uid(), p_card, p_category, p_description, p_purchase_date, p_total_cents, p_installments, p_notes, p_client_key)
  RETURNING id INTO v_id;
  v_base := p_total_cents / p_installments;
  v_rem := p_total_cents - v_base * p_installments;
  FOR i IN 1..p_installments LOOP
    v_amt := v_base + CASE WHEN i <= v_rem THEN 1 ELSE 0 END;
    v_inv := public.ensure_invoice(p_card, (date_trunc('month', p_first_closing_month) + make_interval(months => i - 1))::date);
    INSERT INTO installments (user_id, purchase_id, invoice_id, number, total_count, amount_cents)
    VALUES (auth.uid(), v_id, v_inv, i, p_installments, v_amt);
  END LOOP;
  RETURN v_id;
END $$;

-- Refund (estorno) linked to original purchase, credited on given closing month invoice
CREATE OR REPLACE FUNCTION public.refund_card_purchase(p_purchase uuid, p_amount_cents bigint, p_date date, p_closing_month date, p_client_key uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_p card_purchases%ROWTYPE; v_refunded bigint; v_id uuid; v_inv uuid;
BEGIN
  IF p_client_key IS NOT NULL THEN
    SELECT id INTO v_id FROM card_purchases WHERE user_id = auth.uid() AND client_key = p_client_key;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  SELECT * INTO v_p FROM card_purchases WHERE id = p_purchase AND user_id = auth.uid() AND kind='purchase' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada.'; END IF;
  SELECT COALESCE(sum(total_cents),0) INTO v_refunded FROM card_purchases WHERE refund_of = p_purchase;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN RAISE EXCEPTION 'Valor deve ser positivo.'; END IF;
  IF p_amount_cents > v_p.total_cents - v_refunded THEN RAISE EXCEPTION 'Estorno acima do valor disponível da compra.'; END IF;
  INSERT INTO card_purchases (user_id, card_id, category_id, description, purchase_date, total_cents, installments, kind, refund_of, client_key)
  VALUES (auth.uid(), v_p.card_id, v_p.category_id, 'Estorno: ' || v_p.description, p_date, p_amount_cents, 1, 'refund', p_purchase, p_client_key)
  RETURNING id INTO v_id;
  v_inv := public.ensure_invoice(v_p.card_id, p_closing_month);
  INSERT INTO installments (user_id, purchase_id, invoice_id, number, total_count, amount_cents)
  VALUES (auth.uid(), v_id, v_inv, 1, 1, -p_amount_cents);
  RETURN v_id;
END $$;

-- Delete purchase only if none of its invoices received payments
CREATE OR REPLACE FUNCTION public.delete_card_purchase(p_purchase uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM card_purchases WHERE id = p_purchase AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Compra não encontrada.'; END IF;
  IF EXISTS (SELECT 1 FROM installments i JOIN invoice_payments p ON p.invoice_id = i.invoice_id
             WHERE i.purchase_id = p_purchase OR i.purchase_id IN (SELECT id FROM card_purchases WHERE refund_of = p_purchase)) THEN
    RAISE EXCEPTION 'Há parcelas em faturas com pagamento. Use estorno em vez de excluir.'; END IF;
  DELETE FROM card_purchases WHERE id = p_purchase AND user_id = auth.uid();
END $$;

-- Pay invoice atomically with lock
CREATE OR REPLACE FUNCTION public.pay_invoice(p_invoice uuid, p_account uuid, p_amount_cents bigint, p_date date, p_client_key uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_id uuid; v_total bigint; v_paid bigint;
BEGIN
  IF p_client_key IS NOT NULL THEN
    SELECT id INTO v_id FROM invoice_payments WHERE user_id = auth.uid() AND client_key = p_client_key;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  PERFORM 1 FROM invoices WHERE id = p_invoice AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fatura não encontrada.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_account AND user_id = auth.uid() AND NOT archived) THEN
    RAISE EXCEPTION 'Conta inválida.'; END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN RAISE EXCEPTION 'Valor deve ser positivo.'; END IF;
  SELECT COALESCE(sum(amount_cents),0) INTO v_total FROM installments WHERE invoice_id = p_invoice;
  SELECT COALESCE(sum(amount_cents),0) INTO v_paid FROM invoice_payments WHERE invoice_id = p_invoice;
  IF v_total - v_paid <= 0 THEN RAISE EXCEPTION 'Esta fatura não possui saldo a pagar.'; END IF;
  IF p_amount_cents > v_total - v_paid THEN RAISE EXCEPTION 'Valor acima do saldo da fatura.'; END IF;
  INSERT INTO invoice_payments (user_id, invoice_id, account_id, amount_cents, paid_date, client_key)
  VALUES (auth.uid(), p_invoice, p_account, p_amount_cents, p_date, p_client_key) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.create_card_purchase, public.refund_card_purchase, public.delete_card_purchase, public.pay_invoice, public.invoice_dates, public.clamp_day, public.today_br TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_invoice FROM anon;

-- Signup: profile + suggested categories
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.categories (user_id, name, kind, icon, color) VALUES
    (NEW.id,'Salário','income','briefcase','#16A34A'),
    (NEW.id,'Freelance','income','laptop','#0891B2'),
    (NEW.id,'Outros recebimentos','income','plus-circle','#65A30D'),
    (NEW.id,'Moradia','expense','home','#7C3AED'),
    (NEW.id,'Alimentação','expense','utensils','#EA580C'),
    (NEW.id,'Transporte','expense','car','#0546DE'),
    (NEW.id,'Saúde','expense','heart-pulse','#DC2626'),
    (NEW.id,'Educação','expense','graduation-cap','#2563EB'),
    (NEW.id,'Lazer','expense','gamepad-2','#DB2777'),
    (NEW.id,'Compras','expense','shopping-bag','#CA8A04'),
    (NEW.id,'Assinaturas','expense','repeat','#475569');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
