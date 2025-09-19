/*
  # Add file extensions configuration

  1. New Tables
    - `file_extensions`
      - `id` (uuid, primary key)
      - `extension` (text, unique)
      - `mime_type` (text)
      - `is_enabled` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `file_extensions` table
    - Add policies for authenticated users to manage extensions
    - Add policy for anonymous users to read enabled extensions

  3. Initial Data
    - Insert default file extensions (py, doc, docx, ppt, pptx, pdf, xls, xlsx)
*/

CREATE TABLE IF NOT EXISTS file_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extension text UNIQUE NOT NULL,
  mime_type text NOT NULL,
  is_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE file_extensions ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (admins) to manage extensions
CREATE POLICY "Admins can manage file extensions"
  ON file_extensions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for anonymous users to read enabled extensions
CREATE POLICY "Anyone can read enabled extensions"
  ON file_extensions
  FOR SELECT
  TO anon
  USING (is_enabled = true);

-- Insert default file extensions
INSERT INTO file_extensions (extension, mime_type, is_enabled) VALUES
  ('py', 'text/x-python', true),
  ('doc', 'application/msword', false),
  ('docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', false),
  ('ppt', 'application/vnd.ms-powerpoint', false),
  ('pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', false),
  ('pdf', 'application/pdf', false),
  ('xls', 'application/vnd.ms-excel', false),
  ('xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', false)
ON CONFLICT (extension) DO NOTHING;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_file_extensions_updated_at
  BEFORE UPDATE ON file_extensions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();