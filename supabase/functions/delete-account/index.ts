import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i=0; i<items.length; i+=size) out.push(items.slice(i,i+size));
  return out;
};

async function collectFiles(admin: any, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  const queue = [prefix.replace(/\/$/, '')];
  while (queue.length) {
    const path = queue.shift()!;
    const { data, error } = await admin.storage.from(bucket).list(path, { limit: 1000, offset: 0 });
    if (error) {
      // A bucket may not exist in older projects; missing storage should not
      // prevent the database/account deletion from completing.
      const status = Number(error?.statusCode || error?.status || 0);
      const message = String(error?.message || '').toLowerCase();
      if (status === 404 || message.includes('bucket not found')) return [];
      throw error;
    }
    for (const item of data || []) {
      const full = path ? `${path}/${item.name}` : item.name;
      if (item.id) files.push(full); else queue.push(full);
    }
  }
  return files;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response(JSON.stringify({success:false,message:'Method Not Allowed'}), {status:405,headers:{'content-type':'application/json'}});
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) throw new Error('SERVER_NOT_CONFIGURED');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({success:false,message:'AUTH_REQUIRED'}), {status:401,headers:{'content-type':'application/json'}});

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user?.id) return new Response(JSON.stringify({success:false,message:'AUTH_REQUIRED'}), {status:401,headers:{'content-type':'application/json'}});

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: stores, error: storesError } = await admin.from('stores').select('id').eq('owner_id', user.id);
    if (storesError) throw storesError;

    // Delete every storage object owned by the account: avatar files live under
    // the user id, while merchant media lives under each owned store id.
    const prefixes: Array<[string,string]> = [
      // Personal avatar files are stored under the authenticated user's id.
      ['avatars', user.id],
    ];
    for (const store of stores || []) {
      prefixes.push(['media', `stores/${store.id}`]);
      prefixes.push(['store-avatars', `stores/${store.id}`]);
    }
    for (const [bucket, prefix] of prefixes) {
      const files = await collectFiles(admin, bucket, prefix);
      for (const group of chunk(files, 100)) {
        if (!group.length) continue;
        const { error } = await admin.storage.from(bucket).remove(group);
        if (error) throw error;
      }
    }

    const { data: cleanupResult, error: cleanupError } = await admin.rpc('delete_account_data', { p_uid: user.id });
    if (cleanupError) throw cleanupError;
    if (!cleanupResult?.success) throw new Error('ACCOUNT_DATA_CLEANUP_FAILED');

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user.id, false);
    if (deleteAuthError) throw deleteAuthError;

    return new Response(JSON.stringify({success:true}), {headers:{'content-type':'application/json'}});
  } catch (error) {
    console.error('delete-account error', error);
    const detail = error instanceof Error ? error.message : String(error?.message || error || 'UNKNOWN_ERROR');
    return new Response(JSON.stringify({success:false,message:'تعذر حذف الحساب والبيانات بالكامل. لم يتم إكمال عملية الحذف.', code: detail}), {status:500,headers:{'content-type':'application/json'}});
  }
});
