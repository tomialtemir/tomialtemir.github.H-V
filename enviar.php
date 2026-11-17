<?php
use PHPMailer\PHPMailer\PHPMailer;

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function responder($ok, $mensaje, $codigo = 200) {
    http_response_code($codigo);
    echo json_encode(['ok' => $ok, 'message' => $mensaje], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    responder(false, 'Método no permitido.', 405);
}
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) {
    responder(false, 'El mensaje es demasiado extenso.', 413);
}
foreach (['nombre', 'correo', 'mensaje', 'empresa_web'] as $campo) {
    if (isset($_POST[$campo]) && !is_string($_POST[$campo])) {
        responder(false, 'Revisá los datos del formulario.', 400);
    }
}
if (trim($_POST['empresa_web'] ?? '') !== '') {
    responder(false, 'No se pudo procesar el formulario.', 400);
}
$nombre = trim($_POST['nombre'] ?? '');
$correo = trim($_POST['correo'] ?? '');
$mensaje = trim($_POST['mensaje'] ?? '');
if ($nombre === '' || $mensaje === '' || !filter_var($correo, FILTER_VALIDATE_EMAIL)
    || strlen($nombre) > 600 || strlen($correo) > 254 || strlen($mensaje) > 20000
    || preg_match('/[\r\n\x00]/', $nombre . $correo)) {
    responder(false, 'Completá tu nombre, un correo válido y tu consulta.', 400);
}

// Las credenciales deben guardarse FUERA de public_html.
// También se pueden definir mediante variables de entorno del servidor.
$configPath = dirname(__DIR__) . '/hv-contact-config.php';
$config = is_file($configPath) ? require $configPath : [];
if (!is_array($config)) $config = [];
$setting = static function (string $key) use ($config): string {
    $value = getenv($key);
    if ($value === false || $value === '') $value = $config[$key] ?? '';
    return is_string($value) ? trim($value) : '';
};
$smtpHost = $setting('HV_SMTP_HOST') ?: 'smtp.hostinger.com';
$smtpUser = $setting('HV_SMTP_USER');
$smtpPass = $setting('HV_SMTP_PASSWORD');
$destino = $setting('HV_CONTACT_TO') ?: 'hv.obrasyservicios@gmail.com';
$smtpPort = (int) ($setting('HV_SMTP_PORT') ?: '465');
if ($smtpUser === '' || $smtpPass === '' || $smtpPass === 'REEMPLAZAR_CON_LA_CLAVE_DE_LA_CASILLA' || !filter_var($smtpUser, FILTER_VALIDATE_EMAIL)
    || !filter_var($destino, FILTER_VALIDATE_EMAIL) || !in_array($smtpPort, [465, 587], true)) {
    error_log('HV contacto: configuración SMTP incompleta o incorrecta.');
    responder(false, 'El formulario está temporalmente fuera de servicio. Contactanos por WhatsApp.', 503);
}

try {
    foreach (['Exception.php', 'PHPMailer.php', 'SMTP.php'] as $archivo) {
        $ruta = __DIR__ . '/phpmailer/src/' . $archivo;
        if (!is_file($ruta)) throw new RuntimeException('Falta PHPMailer.');
        require_once $ruta;
    }

    // Límite básico por IP: 5 intentos cada 15 minutos.
    // Los archivos se crean automáticamente fuera de la carpeta de la web.
    $clave = hash('sha256', __DIR__ . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'desconocida'));
    $limite = fopen(sys_get_temp_dir() . '/hv-contacto-' . $clave . '.json', 'c+');
    if ($limite === false) throw new RuntimeException('Límite no disponible.');
    if (!flock($limite, LOCK_EX)) {
        fclose($limite);
        throw new RuntimeException('Límite no disponible.');
    }
    $intentos = json_decode(stream_get_contents($limite), true);
    if (!is_array($intentos)) $intentos = [];
    $intentos = array_values(array_filter($intentos, static function ($t) {
        return is_int($t) && $t > time() - 900;
    }));
    if (count($intentos) >= 5) {
        flock($limite, LOCK_UN);
        fclose($limite);
        header('Retry-After: 900');
        responder(false, 'Esperá 15 minutos antes de volver a enviar o escribinos por WhatsApp.', 429);
    }
    $intentos[] = time();
    rewind($limite);
    ftruncate($limite, 0);
    $guardado = fwrite($limite, json_encode($intentos));
    fflush($limite);
    flock($limite, LOCK_UN);
    fclose($limite);
    if ($guardado === false) throw new RuntimeException('No se pudo guardar el límite.');

    $mail = new PHPMailer(true);
    $mail->isSMTP();
    // El remitente debe coincidir con la casilla SMTP autenticada.
    $mail->Host = $smtpHost;
    $mail->SMTPAuth = true;
    $mail->Username = $smtpUser;
    $mail->Password = $smtpPass;
    $mail->SMTPSecure = $smtpPort === 465
        ? PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = $smtpPort;
    $mail->CharSet = 'UTF-8';
    $mail->SMTPDebug = 0;
    $mail->Timeout = 20;
    $mail->setFrom($smtpUser, 'HV Obras & Servicios');
    $mail->addAddress($destino);
    $mail->addReplyTo($correo, $nombre);
    $mail->isHTML(false);
    $mail->Subject = 'Nueva consulta desde la web de HV';
    $mail->Body = "Nombre / Razón social: {$nombre}\nCorreo: {$correo}\n\nConsulta:\n{$mensaje}\n";
    $mail->send();
    responder(true, 'Tu consulta fue enviada. ¡Gracias por escribirnos!');
} catch (Throwable $error) {
    error_log('HV contacto: error de envío (' . get_class($error) . '): ' . preg_replace('/[\r\n]+/', ' ', $error->getMessage()));
    responder(false, 'No pudimos confirmar el envío. Tus datos siguen en el formulario. Contactanos por WhatsApp si el problema continúa.', 500);
}
