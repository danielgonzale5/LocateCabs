-- LocateCabs schema. The column names and the VARCHAR timestamp (unix time in
-- ms) are kept from the 2021 version.
CREATE TABLE IF NOT EXISTS gps (
  idGPS     INT AUTO_INCREMENT PRIMARY KEY,
  Usuario   VARCHAR(64) NOT NULL,
  Latitud   VARCHAR(32) NOT NULL,
  Longitud  VARCHAR(32) NOT NULL,
  TimeStamp VARCHAR(32) NOT NULL,
  INDEX idx_gps_timestamp (TimeStamp)
);
