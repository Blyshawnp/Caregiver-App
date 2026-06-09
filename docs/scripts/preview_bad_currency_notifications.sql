-- Read-only preview of existing notification rows containing long decimal currency strings
-- This script matches the project guidelines to preview rows before any manual updates.
-- DO NOT automatically run updates.

-- ====================================================
-- READ-ONLY PREVIEW
-- ====================================================
-- Shows:
-- - id: notification ID
-- - created_at: creation timestamp
-- - type/category: notification type
-- - title: notification title
-- - body/message: raw stored message text
-- - extracted_ugly_value: the extracted raw unformatted currency string
-- - proposed_cleaned_text: how the message text will look after formatting
SELECT 
  id,
  created_at,
  kind AS "type/category",
  title,
  body AS "body/message",
  substring(body from '\$\d+\.\d+') AS extracted_ugly_value,
  regexp_replace(
    body,
    '\$\d+\.\d+',
    '$' || to_char(round(replace(substring(body from '\$\d+\.\d+'), '$', '')::numeric, 2), 'FM999999999990.00')
  ) AS proposed_cleaned_text
FROM public.notifications
-- Look for body fields containing a dollar sign followed by numbers and a decimal with 3 or more digits
WHERE body ~ '\$\d+\.\d{3,}';

-- ====================================================
-- TEST / VALIDATION EXAMPLES
-- ====================================================
-- Run this safe select to verify formatting on test inputs:
SELECT
  '$' || to_char(round(360::numeric, 2), 'FM999999999990.00') AS test_360,
  '$' || to_char(round(360.000000000000000000::numeric, 2), 'FM999999999990.00') AS test_decimal,
  '$' || to_char(round(180.5::numeric, 2), 'FM999999999990.00') AS test_float,
  '$' || to_char(round(0::numeric, 2), 'FM999999999990.00') AS test_zero;

-- ====================================================
-- OPTIONAL UPDATE SECTION (Commented out by default)
-- ====================================================
-- To manually clean up existing bad notifications, uncomment and run:
/*
UPDATE public.notifications
SET body = regexp_replace(
  body,
  '\$\d+\.\d+',
  '$' || to_char(round(replace(substring(body from '\$\d+\.\d+'), '$', '')::numeric, 2), 'FM999999999990.00')
)
WHERE body ~ '\$\d+\.\d{3,}';
*/
