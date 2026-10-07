import { supabase } from '../config/supabaseConfig';

export async function getAboutStats() {
  const [productsResult, storesResult, usersResult] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('stores').select('id', { count: 'exact', head: true }),
    supabase.rpc('get_public_user_count'),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (storesResult.error) throw storesResult.error;
  if (usersResult.error) throw usersResult.error;

  return {
    products: productsResult.count || 0,
    merchantCount: storesResult.count || 0,
    shippingCompanies: 0,
    users: Number(usersResult.data) || 0,
  };
}

export default { getAboutStats };
