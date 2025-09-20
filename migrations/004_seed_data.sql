-- Initial seed data for fund categories and churches (PostgreSQL)

INSERT INTO fund_categories (name)
VALUES
  ('General'),
  ('Caballeros'),
  ('Misiones'),
  ('APY'),
  ('Lazos de Amor'),
  ('Mision Posible'),
  ('Niños'),
  ('IBA'),
  ('Damas')
ON CONFLICT (name) DO NOTHING;

INSERT INTO churches (name, city, pastor, pastor_cedula, pastor_grado, pastor_posicion)
VALUES
  ('IPU LAMBARÉ', 'Lambaré', 'Joseph Anthony Bir', '2370941', 'ORDENADO', 'Obispo Consejero'),
  ('IPU EDELIRA', 'Edelira', 'Venancio Vázquez Benítez', '2122970', 'ORDENADO', 'Diácono'),
  ('IPU MARAMBURÉ', 'Maramburé', 'Ricardo Martínez', '1795191', 'ORDENADO', 'Presidente'),
  ('IPU LUQUE', 'Luque', 'Gregorio Chaparro', '1001860', 'ORDENADO', 'Vice-Presidente'),
  ('IPU VILLA HAYES PAÑETE', 'Villa Hayes', 'Juan Gómez', '2447195', 'ORDENADO', 'Director de Misiones'),
  ('IPU ITAUGUÁ', 'Itauguá', 'Ricardo Ramón Ybañez Martínez', '3262368', 'ORDENADO', 'Secretario'),
  ('IPU ANAHÍ', 'Anahí', 'Isidoro Ramírez Ayala', '3592507', 'ORDENADO', 'Pastor'),
  ('IPU CAACUPE', 'Caacupé', 'Abel Ortiz Yrigoyen', '2669610', 'GENERAL', 'Pastor'),
  ('IPU BARBEROS', 'Barberos', 'Hugo Javier Sosa Escobar', '3395880', 'ORDENADO', 'Pastor'),
  ('IPU CAPIATÁ', 'Capiatá', 'Narciso Armoa Palacios', '1232089', 'GENERAL', 'Director de Caballeros'),
  ('IPU ITÁ', 'Itá', 'Ramón Alberto Bogarín Lezcano', '4548452', 'GENERAL', 'Pastor'),
  ('IPU CAAGUAZÚ', 'Caaguazú', 'Christian Antonio Bareiro', '21787099', 'LOCAL', 'Pastor'),
  ('IPU HERNANDARIAS', 'Hernandarias', 'Ramón Jara Santacruz', '5853477', 'LOCAL', 'Pastor'),
  ('IPU CONCEPCIÓN', 'Concepción', 'Vicente Ayala Stumpjs', '1361882', 'LOCAL', 'Pastor'),
  ('IPU ÑEMBY', 'Ñemby', 'Eliezer Jara Ortiz', '4882109', 'LOCAL', 'Pastor'),
  ('IPU ASUNCIÓN', 'Asunción', 'Daves James Linares Silva', '8609861', 'LOCAL', 'Pastor'),
  ('IPU CDE PRIMAVERA', 'Ciudad del Este', 'Johny Quintana', '3707449', 'LOCAL', 'Pastor'),
  ('IPU CDE REMANSITO', 'Ciudad del Este', 'Eddie Yepez', '22430074', 'LOCAL', 'Pastor'),
  ('IPU YUQUYRY', 'Yuquyry', 'Julian Ortiz', '640904', 'LOCAL', 'Pastor'),
  ('IPU PILAR', 'Pilar', 'Alexis Escurra', '5808509', 'LOCAL', 'Pastor'),
  ('IPU EDELIRA KM 28', 'Edelira', 'Adelio Raúl Barreto', '4768440', 'LOCAL', 'Pastor'),
  ('IPU PINDOLO', 'Píndolo', 'Nilton Sotelo', NULL, 'GENERAL', 'Pastor')
ON CONFLICT (name) DO NOTHING;
