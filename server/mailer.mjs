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

const money=value=>`${new Intl.NumberFormat('ru-RU').format(Number(value))} ₽`;
const orderRows=order=>order.items.map(item=>`<tr><td style="padding:10px 0;border-bottom:1px solid #e3ddd2">${escapeHtml(item.name)}<br><small>Размер ${escapeHtml(item.size)} · ${Number(item.quantity)} шт.</small></td><td style="padding:10px 0;border-bottom:1px solid #e3ddd2;text-align:right">${money(Number(item.price)*Number(item.quantity))}</td></tr>`).join('');

export async function sendOrderCreated({order}) {
  if(!transport){console.log(`Новый заказ №${order.id} для ${order.email}`);return false}
  const content=`<p>Здравствуйте, ${escapeHtml(order.customer_name)}. Заказ №${order.id} принят.</p><table style="width:100%;border-collapse:collapse">${orderRows(order)}</table><p style="font-size:20px">Итого: ${money(order.total)}</p><p>Доставка: ${escapeHtml(order.address)}</p><p>Менеджер свяжется с вами для подтверждения.</p>`;
  const customerMail=transport.sendMail({from:process.env.MAIL_FROM||'SARU <no-reply@saru.ru>',to:order.email,subject:`Заказ №${order.id} принят — SARU`,text:`Заказ №${order.id} принят. Итого: ${money(order.total)}. Менеджер свяжется с вами для подтверждения.`,html:shell(`Заказ №${order.id} принят`,content)});
  const moderatorEmail=process.env.MODERATOR_EMAIL||'moderator@saru.ru';
  const moderatorMail=transport.sendMail({from:process.env.MAIL_FROM||'SARU <no-reply@saru.ru>',to:moderatorEmail,subject:`Новый заказ №${order.id} — SARU`,text:`Новый заказ №${order.id}: ${order.customer_name}, ${order.phone}, ${money(order.total)}.`,html:shell(`Новый заказ №${order.id}`,`<p>${escapeHtml(order.customer_name)} · ${escapeHtml(order.phone)}</p><p>${escapeHtml(order.email)}</p><table style="width:100%;border-collapse:collapse">${orderRows(order)}</table><p style="font-size:20px">Итого: ${money(order.total)}</p><p>${escapeHtml(order.address)}</p>`)});
  await Promise.all([customerMail,moderatorMail]);return true;
}

export async function sendOrderStatus({order}) {
  if(!transport)return false;
  const names={confirmed:'подтверждён',shipped:'отправлен',completed:'завершён',cancelled:'отменён',new:'создан'};
  const label=names[order.status]||order.status;
  await transport.sendMail({from:process.env.MAIL_FROM||'SARU <no-reply@saru.ru>',to:order.email,subject:`Заказ №${order.id} ${label} — SARU`,text:`Статус заказа №${order.id}: ${label}.`,html:shell(`Заказ №${order.id} ${escapeHtml(label)}`,`<p>Здравствуйте, ${escapeHtml(order.customer_name)}.</p><p>Статус вашего заказа изменён: <strong>${escapeHtml(label)}</strong>.</p>`) });
  return true;
}
