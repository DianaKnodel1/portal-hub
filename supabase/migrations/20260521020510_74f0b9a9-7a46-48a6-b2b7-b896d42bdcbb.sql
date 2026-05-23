UPDATE auth.users
SET encrypted_password = crypt('Admin1234!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'admin@admin.de';