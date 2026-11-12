
ALTER FUNCTION public.create_card_purchase(uuid,uuid,text,date,bigint,int,date,text,uuid) SECURITY DEFINER;
ALTER FUNCTION public.refund_card_purchase(uuid,bigint,date,date,uuid) SECURITY DEFINER;
ALTER FUNCTION public.delete_card_purchase(uuid) SECURITY DEFINER;
ALTER FUNCTION public.pay_invoice(uuid,uuid,bigint,date,uuid) SECURITY DEFINER;
ALTER FUNCTION public.ensure_invoice(uuid,date) SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.create_card_purchase(uuid,uuid,text,date,bigint,int,date,text,uuid), public.refund_card_purchase(uuid,bigint,date,date,uuid), public.delete_card_purchase(uuid), public.pay_invoice(uuid,uuid,bigint,date,uuid), public.ensure_invoice(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_card_purchase(uuid,uuid,text,date,bigint,int,date,text,uuid), public.refund_card_purchase(uuid,bigint,date,date,uuid), public.delete_card_purchase(uuid), public.pay_invoice(uuid,uuid,bigint,date,uuid) TO authenticated;
REVOKE INSERT, UPDATE ON public.invoices FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_tx_category() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_kind text;
BEGIN
  SELECT kind INTO v_kind FROM categories WHERE id = NEW.category_id;
  IF v_kind IS DISTINCT FROM NEW.kind THEN RAISE EXCEPTION 'Categoria incompatível com o tipo do lançamento.'; END IF;
  IF NEW.kind = 'income' AND NEW.payment_method = 'credit' THEN RAISE EXCEPTION 'Receitas não podem usar crédito.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_tx_cat BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.validate_tx_category();
