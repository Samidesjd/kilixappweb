const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const page = (message = '') => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>حذف حساب Kilix</title><style>body{font-family:Arial,sans-serif;background:#f7f8fa;color:#202124;max-width:680px;margin:0 auto;padding:24px;line-height:1.8}main{background:#fff;padding:28px;border-radius:18px;box-shadow:0 4px 18px #0000000d}input{width:100%;box-sizing:border-box;padding:14px;border:1px solid #ccd0d5;border-radius:12px;font-size:16px;margin:8px 0 14px}button{width:100%;padding:14px;border:0;border-radius:12px;background:#ff6b00;color:#fff;font-size:16px;font-weight:700}.note{color:#666;font-size:14px}h1{margin-top:0}</style></head><body><main><h1>حذف حساب Kilix</h1>${message ? `<p>${message}</p>` : '<p>يمكنك طلب حذف حساب Kilix والبيانات المرتبطة به حتى بعد حذف التطبيق من جهازك.</p>'}<form method="post"><label for="email">البريد الإلكتروني المرتبط بالحساب</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="320" placeholder="example@email.com"><button type="submit">إرسال طلب حذف الحساب</button></form><p class="note">يتم التحقق من الطلب ثم تنفيذ حذف الحساب والبيانات المرتبطة به وفق سياسة الخصوصية. قد تحتفظ Kilix فقط بالبيانات التي يلزم الاحتفاظ بها قانونيًا أو أمنيًا أو لتسوية معاملة أو نزاع قائم.</p></main></body></html>`;
async function submitRequest(email: string) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('SERVER_NOT_CONFIGURED');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/account_deletion_requests`, { method:'POST', headers:{ apikey:SERVICE_ROLE_KEY, Authorization:`Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type':'application/json', Prefer:'return=minimal' }, body:JSON.stringify({email}) });
  if (!r.ok) throw new Error(`REQUEST_FAILED_${r.status}`);
}
Deno.serve(async (req) => {
  if (req.method === 'GET') return new Response(page(), {headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  if (req.method !== 'POST') return new Response('Method Not Allowed',{status:405});
  try {
    const form = await req.formData();
    const email = String(form.get('email')||'').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return new Response(page('<strong>البريد الإلكتروني غير صحيح.</strong>'), {status:400,headers:{'content-type':'text/html; charset=utf-8'}});
    await submitRequest(email);
    return new Response(page('<strong>تم تسجيل طلب حذف الحساب بنجاح.</strong><br>سيتم التحقق من الطلب ثم تنفيذ الحذف وفق سياسة الخصوصية.'), {headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  } catch (error) {
    console.error('account-deletion request error', error);
    return new Response(page('تعذر تسجيل الطلب حاليًا. يرجى المحاولة مرة أخرى لاحقًا.'), {status:500,headers:{'content-type':'text/html; charset=utf-8'}});
  }
});
