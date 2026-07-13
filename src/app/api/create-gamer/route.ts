import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { name, employeeId, defaultPassword, phone, level, gamer_role, team_leader_id } = await request.json();

    if (!name || !employeeId || !defaultPassword) {
      return NextResponse.json({ error: 'Name, Employee ID, and Default Password are required.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase configuration or Service Role Key missing on server.' }, { status: 500 });
    }

    // Initialize administrative client bypassing RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const cleanEmpId = employeeId.trim().toUpperCase();
    const syntheticEmail = `${cleanEmpId.toLowerCase()}@gamers.zampeak.com`;

    // 1. Directly create the Auth User with email confirmation bypassed
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password: defaultPassword,
      email_confirm: true
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to register gamer auth credentials.' }, { status: 500 });
    }

    // 2. Insert database gamer record linked to auth ID
    const newGamer = {
      id: authData.user.id,
      name: name.trim(),
      employee_id: cleanEmpId,
      email: syntheticEmail,
      default_password: defaultPassword,
      phone: phone || '',
      status: 'active',
      level: level || 'beginner',
      gamer_role: gamer_role || 'gamer',
      team_leader_id: team_leader_id || null,
      created_at: new Date().toISOString()
    };

    const { error: dbError } = await supabaseAdmin
      .from('gamers')
      .insert([newGamer]);

    if (dbError) {
      // Clean up orphaned auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, gamer: newGamer });
  } catch (err: any) {
    console.error('API create-gamer error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
