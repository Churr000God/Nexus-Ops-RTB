-- =====================================================================
-- RTB · Seed de CFDI 4.0
-- Issuer config, series, ejemplo PPD con dos pagos parciales,
-- ejemplo de cancelación con sustitución, ejemplo de NC tipo E
-- =====================================================================
SET search_path = rtb, public;

-- ─────────────────────────────────────────────────────────────────────
-- 1) Configuración del emisor (RTB)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO cfdi_issuer_config (
    rfc, legal_name, tax_regime_id, zip_code, place_of_issue_zip,
    csd_certificate_path, csd_key_path, csd_password_encrypted, csd_serial_number,
    csd_valid_from, csd_valid_to,
    pac_provider, pac_username, pac_endpoint_url, pac_credentials_encrypted, pac_environment,
    is_active, valid_from, notes
) VALUES (
    'RTB850101AB7', 'RTB Industrial S.A. de C.V.', 601, '64000', '64000',
    '/secure/csd/RTB850101AB7.cer', '/secure/csd/RTB850101AB7.key',
    'ENCRYPTED:vault:secret:rtb-csd-password',
    '00001000000412345678',
    '2024-01-01', '2028-01-01',
    'Diverza', 'rtb_user', 'https://api.diverza.com/v1/cfdi',
    'ENCRYPTED:vault:secret:rtb-pac-creds',
    'PRODUCTION',
    TRUE, '2024-01-01',
    'Configuración inicial. Renovar CSD antes de 2028-01-01.'
);


-- ─────────────────────────────────────────────────────────────────────
-- 2) Series y folios
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO cfdi_series (series, cfdi_type, description, next_folio, is_active) VALUES
  ('A',   'I', 'Factura de Ingreso (venta normal)',          1, TRUE),
  ('NC',  'E', 'Nota de Crédito (Egreso)',                   1, TRUE),
  ('CP',  'P', 'Complemento de Pago para PPD',               1, TRUE),
  ('EXP', 'I', 'Factura de exportación',                     1, TRUE)
ON CONFLICT (series) DO NOTHING;

-- Catálogos SAT mínimos para CFDI uses (en producción se carga el catálogo completo)
INSERT INTO sat_cfdi_uses (use_id, description) VALUES
  ('G01','Adquisición de mercancías'),
  ('G02','Devoluciones, descuentos o bonificaciones'),
  ('G03','Gastos en general'),
  ('I01','Construcciones'),
  ('I04','Equipo de cómputo y accesorios'),
  ('P01','Por definir'),
  ('S01','Sin efectos fiscales')
ON CONFLICT (use_id) DO NOTHING;

INSERT INTO sat_tax_regimes (regime_id, description) VALUES
  (601,'General de Ley Personas Morales'),
  (603,'Personas Morales con Fines no Lucrativos'),
  (612,'Personas Físicas con Actividades Empresariales y Profesionales'),
  (621,'Incorporación Fiscal'),
  (626,'Régimen Simplificado de Confianza')
ON CONFLICT (regime_id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- 3) EMITIR CFDI tipo I PPD a Femsa
-- ─────────────────────────────────────────────────────────────────────

-- Reservar folio
DO $$
DECLARE
    v_series_id BIGINT; v_folio BIGINT;
    v_config_id BIGINT;
    v_customer_id BIGINT; v_tax_id BIGINT;
    v_cfdi_id BIGINT;
BEGIN
    SELECT out_series_id, out_folio INTO v_series_id, v_folio
    FROM fn_assign_cfdi_folio('A');

    SELECT config_id INTO v_config_id
    FROM cfdi_issuer_config WHERE is_active LIMIT 1;

    SELECT c.customer_id,
           (SELECT tax_data_id FROM customer_tax_data WHERE customer_id = c.customer_id AND is_default LIMIT 1)
    INTO v_customer_id, v_tax_id
    FROM customers c WHERE c.code = 'FEMSA';

    INSERT INTO cfdi (
        cfdi_type, series_id, folio,
        customer_id, customer_tax_data_id,
        issuer_rfc, issuer_legal_name, issuer_tax_regime_id, issuer_zip_code,
        receiver_rfc, receiver_legal_name, receiver_tax_regime_id, receiver_zip_code,
        cfdi_use_id, payment_method_id, payment_form_id,
        currency, exchange_rate,
        place_of_issue_zip,
        subtotal, discount, tax_amount, total,
        issuer_config_id, status,
        pac_provider
    ) VALUES (
        'I', v_series_id, v_folio,
        v_customer_id, v_tax_id,
        'RTB850101AB7', 'RTB Industrial S.A. de C.V.', 601, '64000',
        (SELECT rfc FROM customer_tax_data WHERE tax_data_id = v_tax_id),
        (SELECT legal_name FROM customer_tax_data WHERE tax_data_id = v_tax_id),
        601, '64000',
        'G01', 'PPD', NULL,
        'MXN', 1,
        '64000',
        100000, 0, 16000, 116000,
        v_config_id, 'TIMBRADO',
        'Diverza'
    ) RETURNING cfdi_id INTO v_cfdi_id;

    -- Datos del timbrado (en realidad los devuelve el PAC)
    UPDATE cfdi SET
        uuid = '550E8400-E29B-41D4-A716-446655440000',
        sello_cfdi = 'sello_simulado_para_seed',
        sello_sat = 'sello_sat_simulado',
        certificate_number = '00001000000412345678',
        sat_certificate_no = '00001000000404555555',
        timbre_date = '2026-04-25 10:30:00'::TIMESTAMPTZ,
        xml_path = '/storage/cfdi/2026/04/' || v_cfdi_id || '.xml',
        pdf_path = '/storage/cfdi/2026/04/' || v_cfdi_id || '.pdf'
    WHERE cfdi_id = v_cfdi_id;

    -- Bitácora del timbrado
    INSERT INTO cfdi_pac_log (
        cfdi_id, operation, attempt_number, pac_provider,
        success, uuid_received, sello_sat,
        user_id
    ) VALUES (
        v_cfdi_id, 'TIMBRAR', 1, 'Diverza',
        TRUE, '550E8400-E29B-41D4-A716-446655440000', 'sello_sat_simulado',
        (SELECT user_id FROM users WHERE email = 'admin@rtb.com')
    );
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 4) Pagos parciales con complementos de pago (CFDI tipo P)
-- ─────────────────────────────────────────────────────────────────────

-- Pago 1: $40,000 el 15 de marzo
DO $$
DECLARE
    v_cfdi_i_id BIGINT; v_payment_id BIGINT;
    v_cfdi_p_id BIGINT; v_series_id BIGINT; v_folio BIGINT;
    v_config_id BIGINT; v_customer_id BIGINT; v_tax_id BIGINT;
BEGIN
    SELECT cfdi_id INTO v_cfdi_i_id FROM cfdi WHERE uuid = '550E8400-E29B-41D4-A716-446655440000';
    SELECT config_id INTO v_config_id FROM cfdi_issuer_config WHERE is_active LIMIT 1;
    SELECT customer_id, customer_tax_data_id INTO v_customer_id, v_tax_id FROM cfdi WHERE cfdi_id = v_cfdi_i_id;

    -- Registrar el pago recibido
    INSERT INTO payments (payment_number, customer_id, payment_date, payment_form_id, bank_reference, amount)
    VALUES ('PAY-2026-200', v_customer_id, '2026-03-15', '03', 'TRANSF-998877', 40000)
    RETURNING payment_id INTO v_payment_id;

    INSERT INTO payment_applications (payment_id, cfdi_id, amount_applied)
    VALUES (v_payment_id, v_cfdi_i_id, 40000);

    -- Emitir CFDI tipo P (complemento de pago)
    SELECT out_series_id, out_folio INTO v_series_id, v_folio FROM fn_assign_cfdi_folio('CP');

    INSERT INTO cfdi (
        cfdi_type, series_id, folio, customer_id, customer_tax_data_id,
        issuer_rfc, issuer_legal_name, issuer_tax_regime_id, issuer_zip_code,
        receiver_rfc, receiver_legal_name, receiver_tax_regime_id, receiver_zip_code,
        cfdi_use_id, payment_method_id,
        currency, place_of_issue_zip,
        subtotal, tax_amount, total,
        issuer_config_id, status, pac_provider,
        uuid, timbre_date
    ) VALUES (
        'P', v_series_id, v_folio, v_customer_id, v_tax_id,
        'RTB850101AB7', 'RTB Industrial S.A. de C.V.', 601, '64000',
        (SELECT rfc FROM customer_tax_data WHERE tax_data_id = v_tax_id),
        (SELECT legal_name FROM customer_tax_data WHERE tax_data_id = v_tax_id),
        601, '64000',
        'P01', 'PUE',     -- siempre PUE en CFDI tipo P
        'XXX', '64000',   -- moneda XXX se usa en complementos
        0, 0, 0,          -- los CFDI P van en cero (el monto va en el complemento)
        v_config_id, 'TIMBRADO', 'Diverza',
        'AAAA1111-AAAA-1111-AAAA-111111111111',
        '2026-03-15 14:00:00'::TIMESTAMPTZ
    ) RETURNING cfdi_id INTO v_cfdi_p_id;

    -- Detalle del complemento
    INSERT INTO cfdi_payments (
        payment_cfdi_id, related_cfdi_id, payment_date, payment_form_id,
        currency, exchange_rate, payment_amount,
        partiality_number, previous_balance, paid_amount, remaining_balance
    ) VALUES (
        v_cfdi_p_id, v_cfdi_i_id, '2026-03-15 14:00:00'::TIMESTAMPTZ, '03',
        'MXN', 1, 40000,
        1, 116000, 40000, 76000
    );
END $$;

-- Pago 2: $76,000 el 30 de abril (saldando)
DO $$
DECLARE
    v_cfdi_i_id BIGINT; v_payment_id BIGINT;
    v_cfdi_p_id BIGINT; v_series_id BIGINT; v_folio BIGINT;
    v_config_id BIGINT; v_customer_id BIGINT; v_tax_id BIGINT;
BEGIN
    SELECT cfdi_id INTO v_cfdi_i_id FROM cfdi WHERE uuid = '550E8400-E29B-41D4-A716-446655440000';
    SELECT config_id INTO v_config_id FROM cfdi_issuer_config WHERE is_active LIMIT 1;
    SELECT customer_id, customer_tax_data_id INTO v_customer_id, v_tax_id FROM cfdi WHERE cfdi_id = v_cfdi_i_id;

    INSERT INTO payments (payment_number, customer_id, payment_date, payment_form_id, bank_reference, amount)
    VALUES ('PAY-2026-201', v_customer_id, '2026-04-30', '03', 'TRANSF-998878', 76000)
    RETURNING payment_id INTO v_payment_id;

    INSERT INTO payment_applications (payment_id, cfdi_id, amount_applied)
    VALUES (v_payment_id, v_cfdi_i_id, 76000);

    SELECT out_series_id, out_folio INTO v_series_id, v_folio FROM fn_assign_cfdi_folio('CP');

    INSERT INTO cfdi (
        cfdi_type, series_id, folio, customer_id, customer_tax_data_id,
        issuer_rfc, issuer_legal_name, issuer_tax_regime_id, issuer_zip_code,
        receiver_rfc, receiver_legal_name, receiver_tax_regime_id, receiver_zip_code,
        cfdi_use_id, payment_method_id, currency, place_of_issue_zip,
        subtotal, tax_amount, total,
        issuer_config_id, status, pac_provider, uuid, timbre_date
    ) VALUES (
        'P', v_series_id, v_folio, v_customer_id, v_tax_id,
        'RTB850101AB7', 'RTB Industrial S.A. de C.V.', 601, '64000',
        (SELECT rfc FROM customer_tax_data WHERE tax_data_id = v_tax_id),
        (SELECT legal_name FROM customer_tax_data WHERE tax_data_id = v_tax_id),
        601, '64000',
        'P01', 'PUE', 'XXX', '64000',
        0, 0, 0, v_config_id, 'TIMBRADO', 'Diverza',
        'BBBB2222-BBBB-2222-BBBB-222222222222',
        '2026-04-30 09:00:00'::TIMESTAMPTZ
    ) RETURNING cfdi_id INTO v_cfdi_p_id;

    INSERT INTO cfdi_payments (
        payment_cfdi_id, related_cfdi_id, payment_date, payment_form_id,
        currency, exchange_rate, payment_amount,
        partiality_number, previous_balance, paid_amount, remaining_balance
    ) VALUES (
        v_cfdi_p_id, v_cfdi_i_id, '2026-04-30 09:00:00'::TIMESTAMPTZ, '03',
        'MXN', 1, 76000,
        2, 76000, 76000, 0           -- saldo final = 0
    );
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 5) NOTA DE CRÉDITO (CFDI tipo E)
-- ─────────────────────────────────────────────────────────────────────
-- Caso: cliente devuelve $5,800 de mercancía después de facturar
DO $$
DECLARE
    v_cfdi_i_id BIGINT; v_cfdi_e_id BIGINT;
    v_series_id BIGINT; v_folio BIGINT;
    v_config_id BIGINT; v_customer_id BIGINT; v_tax_id BIGINT;
BEGIN
    SELECT cfdi_id, customer_id, customer_tax_data_id
    INTO v_cfdi_i_id, v_customer_id, v_tax_id
    FROM cfdi WHERE uuid = '550E8400-E29B-41D4-A716-446655440000';
    SELECT config_id INTO v_config_id FROM cfdi_issuer_config WHERE is_active LIMIT 1;

    SELECT out_series_id, out_folio INTO v_series_id, v_folio FROM fn_assign_cfdi_folio('NC');

    INSERT INTO cfdi (
        cfdi_type, series_id, folio, customer_id, customer_tax_data_id,
        issuer_rfc, issuer_legal_name, issuer_tax_regime_id, issuer_zip_code,
        receiver_rfc, receiver_legal_name, receiver_tax_regime_id, receiver_zip_code,
        cfdi_use_id, payment_method_id, payment_form_id,
        currency, place_of_issue_zip,
        subtotal, tax_amount, total,
        issuer_config_id, status, pac_provider, uuid, timbre_date
    ) VALUES (
        'E', v_series_id, v_folio, v_customer_id, v_tax_id,
        'RTB850101AB7', 'RTB Industrial S.A. de C.V.', 601, '64000',
        (SELECT rfc FROM customer_tax_data WHERE tax_data_id = v_tax_id),
        (SELECT legal_name FROM customer_tax_data WHERE tax_data_id = v_tax_id),
        601, '64000',
        'G02', 'PUE', '03',
        'MXN', '64000',
        5000, 800, 5800,
        v_config_id, 'TIMBRADO', 'Diverza',
        'CCCC3333-CCCC-3333-CCCC-333333333333',
        '2026-05-05 11:00:00'::TIMESTAMPTZ
    ) RETURNING cfdi_id INTO v_cfdi_e_id;

    INSERT INTO cfdi_credit_notes (
        credit_cfdi_id, related_cfdi_id, relation_type, reason, refund_amount
    ) VALUES (
        v_cfdi_e_id, v_cfdi_i_id, '03',
        'Devolución de 1 cilindro defectuoso reportado por el cliente',
        5800
    );
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 6) VALIDACIONES
-- ─────────────────────────────────────────────────────────────────────

-- CFDIs emitidos con sus saldos
SELECT uuid, cfdi_type, series, folio, customer, total,
       amount_paid_via_complementos AS pagado, credit_note_amount AS nc,
       status
FROM v_cfdi_emitted
ORDER BY issue_date;

-- PPDs pendientes de pago
SELECT * FROM v_cfdi_ppd_pending_payment;
-- En este seed, debería estar vacía (la factura se pagó completa)

-- Pagos sin aplicar
SELECT * FROM v_payments_unapplied;

-- Bitácora PAC
SELECT cfdi_id, operation, success, attempt_at, uuid_received
FROM cfdi_pac_log
ORDER BY attempt_at;

-- Resumen de facturación del mes
SELECT * FROM v_cfdi_summary_by_period
WHERE year = 2026 AND month = 4
ORDER BY cfdi_type;

-- Cancelaciones (vacío en este seed)
SELECT * FROM v_cfdi_cancellations;
