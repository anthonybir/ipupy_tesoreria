import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const ruc = searchParams.get('ruc');

    if (!ruc) {
      return NextResponse.json(
        { error: 'RUC es requerido' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('find_provider_by_ruc', {
      p_ruc: ruc,
    });

    if (error) {
      console.error('Error checking RUC:', error);
      return NextResponse.json(
        { error: 'Error al verificar RUC' },
        { status: 500 }
      );
    }

    if (data && data.length > 0) {
      return NextResponse.json({
        exists: true,
        provider: data[0],
      });
    }

    return NextResponse.json({
      exists: false,
      provider: null,
    });
  } catch (error) {
    console.error('Error in GET /api/providers/check-ruc:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}