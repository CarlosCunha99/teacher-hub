CREATE TABLE terms_acceptances (
    id SERIAL PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    terms_version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (teacher_id, terms_version)
);
