-- ==========================================
-- SCRIPT DE BLINDAJE DE SEGURIDAD (RLS)
-- Corre este script en la consola SQL de Supabase
-- ==========================================

-- 1. Habilitar RLS en todas las tablas críticas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE trains ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICAS PARA LA TABLA 'PROFILES'
-- Los usuarios pueden leer su propio perfil
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil (limitado a campos no sensibles si se desea)
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- Solo Admins pueden ver todos los perfiles
CREATE POLICY "Admins can view all profiles" 
ON profiles FOR SELECT 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Solo Admins pueden borrar perfiles
CREATE POLICY "Only admins can delete profiles" 
ON profiles FOR DELETE 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- 3. POLÍTICAS PARA LA TABLA 'OPERATIONS' (VIAJES)
-- Choferes pueden insertar sus propios viajes
CREATE POLICY "Drivers can insert own operations" 
ON operations FOR INSERT 
WITH CHECK (driver_id = auth.uid());

-- Choferes pueden ver sus propios viajes
CREATE POLICY "Drivers can view own operations" 
ON operations FOR SELECT 
USING (driver_id = auth.uid());

-- Solo Admins pueden editar o borrar viajes
CREATE POLICY "Only admins can update/delete operations" 
ON operations FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- 4. POLÍTICAS PARA LA TABLA 'EXPENSES' (GASTOS)
-- Choferes pueden insertar sus propios gastos
CREATE POLICY "Drivers can insert own expenses" 
ON expenses FOR INSERT 
WITH CHECK (driver_id = auth.uid());

-- Choferes pueden ver sus propios gastos
CREATE POLICY "Drivers can view own expenses" 
ON expenses FOR SELECT 
USING (driver_id = auth.uid());

-- Solo Admins pueden editar o borrar gastos
CREATE POLICY "Only admins can update/delete expenses" 
ON expenses FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- 5. POLÍTICAS PARA 'DAILY_CLOSURES' (CIERRES)
-- Choferes pueden insertar cierres si les pertenecen
CREATE POLICY "Drivers can insert own closures" 
ON daily_closures FOR INSERT 
WITH CHECK (driver_id = auth.uid());

-- Choferes pueden leer cierres actuales
CREATE POLICY "Drivers can view closures" 
ON daily_closures FOR SELECT 
USING (driver_id = auth.uid());

-- Solo Admins pueden borrar cierres (Reabrir caja)
CREATE POLICY "Only admins can manage closures" 
ON daily_closures FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- 6. POLÍTICAS PARA 'TRAINS' (FLOTA)
-- Todos los autenticados pueden ver la flota
CREATE POLICY "Authenticated users can view trains" 
ON trains FOR SELECT 
TO authenticated 
USING (true);

-- Solo Admins pueden gestionar la flota
CREATE POLICY "Only admins can manage trains" 
ON trains FOR ALL 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );
