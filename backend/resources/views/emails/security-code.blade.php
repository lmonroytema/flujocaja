<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>{{ $subjectLine }}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
        <div style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.12);">
            <div style="padding:28px 32px;background:linear-gradient(135deg,#7f1022 0%,#b30f28 100%);color:#ffffff;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;opacity:0.82;">Flujo de Caja Tema Perú</p>
                <h1 style="margin:0;font-size:28px;line-height:1.2;">{{ $headline }}</h1>
            </div>
            <div style="padding:32px;">
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#475569;">{{ $intro }}</p>
                <div style="margin:28px 0;padding:20px;border-radius:20px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;">
                    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#94a3b8;">Código</p>
                    <p style="margin:0;font-size:34px;font-weight:700;letter-spacing:0.3em;color:#a40f22;">{{ $code }}</p>
                </div>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#64748b;">{{ $footer }}</p>
            </div>
        </div>
    </div>
</body>
</html>
