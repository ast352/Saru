import nodemailer from 'nodemailer';

const transport = process.env.SMTP_HOST ? nodemailer.createTransport({
  host:process.env.SMTP_HOST,
  port:Number(process.env.SMTP_PORT||587),
  secure:process.env.SMTP_SECURE==='true',
  auth:process.env.SMTP_USER ? {user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,
}) : null;

const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]);
const shell=(title,content)=>`<!doctype html><html><body style="margin:0;background:#f6f0e3;color:#253127;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto;padding:48px 28px"><div style="font:24px Georgia,serif;letter-spacing:.18em;margin-bottom:42px">SARU</div><div style="background:#fffaf0;padding:34px;border:1px solid #d8d1c4"><h1 style="font:30px Georgia,serif;font-weight:400">${title}</h1>${content}</div><p style="color:#6e746c;font-size:12px;line-height:1.6;margin-top:22px">Если вы не запрашивали это письмо, просто проигнорируйте его.</p></div></body></html>`;
const button=(href,label)=>`<p style="margin:30px 0"><a href="${href}" style="display:inline-block;padding:15px 23px;background:#667761;color:white;text-decoration:none">${label}</a></p>`;

export async function sendPasswordReset({email,name,token}) {
  const base=process.env.PUBLIC_URL||'http://localhost:5173';
  const link=`${base}/?reset=${encodeURIComponent(token)}`;
  if(!transport) {
    console.log(`Восстановление для ${email}: ${link}`);
    return false;
  }
  await transport.sendMail({
    from:process.env.MAIL_FROM||'SARU <no-reply@saru.ru>',
    to:email,
    subject:'Восстановление доступа к SARU',
    text:`Здравствуйте, ${name}. Установить новый пароль: ${link}. Ссылка действует 20 минут.`,
    html:shell('Восстановление доступа',`<p>Здравствуйте, ${escapeHtml(name)}.</p>${button(link,'Установить новый пароль')}<p>Ссылка действует 20 минут.</p>`),
  });
  return true;
}

export async function sendEmailVerification({email,name,token}) {
  const base=process.env.PUBLIC_URL||'http://localhost:5173';
  const link=`${base}/?verify=${encodeURIComponent(token)}`;
  if(!transport){
    console.log(`Подтверждение почты для ${email}: ${link}`);
    return false;
  }
  await transport.sendMail({
    from:process.env.MAIL_FROM||'SARU <no-reply@saru.ru>',
    to:email,
    subject:'Подтвердите почту — SARU',
    text:`Здравствуйте, ${name}. Подтвердить почту: ${link}. Ссылка действует 24 часа.`,
    html:shell('Подтвердите почту',`<p>Здравствуйте, ${escapeHtml(name)}.</p><p>Подтвердите адрес, чтобы получать важные сообщения о заказах.</p>${button(link,'Подтвердить почту')}<p>Ссылка действует 24 часа.</p>`),
  });
  return true;
}
