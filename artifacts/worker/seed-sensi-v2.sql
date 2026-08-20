-- Sensitivity presets v2: FF sliders run 0-200 (DEFAULT and HIGH modes).
DELETE FROM ff_sensitivity_presets;
INSERT INTO ff_sensitivity_presets (id, label, ram_gb, gyro, dpi, values_json, created_at) VALUES
(20, '2GB Budget Saver (Non-Gyro)', '2', 'off', 'standard', '{"general":139,"redDot":128,"scope2x":113,"scope4x":104,"awm":84,"freeLook":116}', datetime('now')),
(21, '2GB Budget Saver (Gyro)', '2', 'on', 'standard', '{"general":139,"redDot":128,"scope2x":113,"scope4x":104,"awm":84,"freeLook":116,"gyroGeneral":167,"gyroRedDot":157,"gyroScope2x":132,"gyroScope4x":110,"gyroAwm":77}', datetime('now')),
(30, '3GB Smooth Runner (Non-Gyro)', '3', 'off', 'standard', '{"general":149,"redDot":136,"scope2x":120,"scope4x":111,"awm":89,"freeLook":124}', datetime('now')),
(31, '3GB Smooth Runner (Gyro)', '3', 'on', 'standard', '{"general":149,"redDot":136,"scope2x":120,"scope4x":111,"awm":89,"freeLook":124,"gyroGeneral":177,"gyroRedDot":166,"gyroScope2x":140,"gyroScope4x":117,"gyroAwm":82}', datetime('now')),
(40, '4GB Classic Headshot (Non-Gyro)', '4', 'off', 'standard', '{"general":158,"redDot":145,"scope2x":128,"scope4x":118,"awm":95,"freeLook":132}', datetime('now')),
(41, '4GB Classic Headshot (Gyro)', '4', 'on', 'standard', '{"general":158,"redDot":145,"scope2x":128,"scope4x":118,"awm":95,"freeLook":132,"gyroGeneral":187,"gyroRedDot":175,"gyroScope2x":147,"gyroScope4x":123,"gyroAwm":86}', datetime('now')),
(60, '6GB Power Flick (Non-Gyro)', '6', 'off', 'standard', '{"general":158,"redDot":145,"scope2x":128,"scope4x":118,"awm":95,"freeLook":132}', datetime('now')),
(61, '6GB Power Flick (Gyro)', '6', 'on', 'standard', '{"general":158,"redDot":145,"scope2x":128,"scope4x":118,"awm":95,"freeLook":132,"gyroGeneral":187,"gyroRedDot":175,"gyroScope2x":147,"gyroScope4x":123,"gyroAwm":86}', datetime('now')),
(80, '8GB Elite Drag (Non-Gyro)', '8', 'off', 'standard', '{"general":171,"redDot":157,"scope2x":138,"scope4x":127,"awm":103,"freeLook":143}', datetime('now')),
(81, '8GB Elite Drag (Gyro)', '8', 'on', 'standard', '{"general":171,"redDot":157,"scope2x":138,"scope4x":127,"awm":103,"freeLook":143,"gyroGeneral":190,"gyroRedDot":178,"gyroScope2x":150,"gyroScope4x":125,"gyroAwm":88}', datetime('now'));
