import nodemailer from 'nodemailer';

const transport = process.env.SMTP_HOST ? nodemailer.createTransport({
  host:process.env.SMTP_HOST,
  port:Number(process.env.SMTP_PORT||587),
  secure:process.env.SMTP_SECURE==='true',
  auth:process.env.SMTP_USER ? {user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,
}) : null;

export async function sendPasswordReset({email,name,token}) {
  const base=process.env.PUBLIC_URL||'http://localhost:5173';
  const link=`${base}/?reset=${encodeURIComponent(token)}`;
  if(!transport) {
    console.log(`Восстановление для ${email}: ${link}`);
    return false;
  }
  await transport.sendMail({
    from:process.env.MAIL_FROM||'Сару <no-reply@saru.ru>',
    to:email,
    subject:'Восстановление доступа к Сару',
    text:`Здравствуйте, ${name}. Установить новый пароль: ${link}. Ссылка действует 20 минут.`,
    html:`<p>Здравствуйте, ${name}.</p><p><a href="${link}">Установить новый пароль</a></p><p>Ссылка действует 20 минут.</p>`,
  });
  return true;
}
