-- Hotel Order Tracking Database Schema

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'staff');
CREATE TYPE order_status AS ENUM ('pending', 'preparing', 'ready', 'delivered', 'cancelled');
CREATE TYPE room_status AS ENUM ('available', 'occupied', 'maintenance', 'cleaning', 'out_of_order');

-- Users table (admin and staff)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'staff',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rooms table (30 rooms)
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(10) UNIQUE NOT NULL,
    floor_number INTEGER NOT NULL,
    status room_status DEFAULT 'available',
    qr_code VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Menu categories
CREATE TABLE IF NOT EXISTS menu_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Menu items
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES menu_categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT true,
    preparation_time INTEGER DEFAULT 15, -- minutes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status order_status DEFAULT 'pending',
    special_instructions TEXT,
    estimated_delivery_time TIMESTAMP,
    assigned_staff_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    special_requests TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order status history table (for tracking)
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    status order_status NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_room_id ON orders(room_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, role, is_active) VALUES 
('admin', 'admin@hotel.com', '$2a$12$.l6TBIfosafQZuXKWMfi9eO6yrd4Jm/Mom5A.Bna4ed1b8TlCmeci', 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- Insert sample staff user (password: staff123)
INSERT INTO users (username, email, password_hash, role, is_active) VALUES 
('staff', 'staff@hotel.com', '$2a$12$vZ8b3wk0WDbpQZuXKWMfi9eO6yrd4Jm/Mom5A.Bna4ed3b8TlCmef', 'staff', true)
ON CONFLICT (username) DO NOTHING;

-- Insert 30 rooms
INSERT INTO rooms (room_number, floor_number, qr_code) VALUES
('101', 1, 'ROOM_101_QR'),
('102', 1, 'ROOM_102_QR'),
('103', 1, 'ROOM_103_QR'),
('104', 1, 'ROOM_104_QR'),
('105', 1, 'ROOM_105_QR'),
('106', 1, 'ROOM_106_QR'),
('107', 1, 'ROOM_107_QR'),
('108', 1, 'ROOM_108_QR'),
('109', 1, 'ROOM_109_QR'),
('110', 1, 'ROOM_110_QR'),
('201', 2, 'ROOM_201_QR'),
('202', 2, 'ROOM_202_QR'),
('203', 2, 'ROOM_203_QR'),
('204', 2, 'ROOM_204_QR'),
('205', 2, 'ROOM_205_QR'),
('206', 2, 'ROOM_206_QR'),
('207', 2, 'ROOM_207_QR'),
('208', 2, 'ROOM_208_QR'),
('209', 2, 'ROOM_209_QR'),
('210', 2, 'ROOM_210_QR'),
('301', 3, 'ROOM_301_QR'),
('302', 3, 'ROOM_302_QR'),
('303', 3, 'ROOM_303_QR'),
('304', 3, 'ROOM_304_QR'),
('305', 3, 'ROOM_305_QR'),
('306', 3, 'ROOM_306_QR'),
('307', 3, 'ROOM_307_QR'),
('308', 3, 'ROOM_308_QR'),
('309', 3, 'ROOM_309_QR'),
('310', 3, 'ROOM_310_QR')
ON CONFLICT (room_number) DO NOTHING;

-- Insert menu categories
INSERT INTO menu_categories (name, description, display_order) VALUES
('Đồ uống nóng', 'Cà phê, trà, đồ uống nóng khác', 1),
('Đồ uống lạnh', 'Nước ngọt, nước ép, đồ uống lạnh', 2),
('Đồ ăn nhẹ', 'Bánh mì, bánh ngọt, snack', 3),
('Cơm - Phở', 'Cơm, phở, bún, các món chính', 4),
('Tráng miệng', 'Chè, kem, trái cây', 5)
ON CONFLICT DO NOTHING;

-- Insert sample menu items
INSERT INTO menu_items (category_id, name, description, price, preparation_time, is_available) VALUES
-- Đồ uống nóng
(1, 'Cà phê đen', 'Cà phê đen truyền thống', 25000, 5, true),
(1, 'Cà phê sữa', 'Cà phê sữa đá hoặc nóng', 30000, 5, true),
(1, 'Trà chanh', 'Trà chanh tươi', 20000, 3, true),
(1, 'Trà đào', 'Trà đào cam sả', 35000, 5, true),

-- Đồ uống lạnh
(2, 'Coca Cola', 'Coca Cola lon 330ml', 15000, 1, true),
(2, 'Nước cam ép', 'Nước cam tươi ép', 30000, 5, true),
(2, 'Sinh tố bơ', 'Sinh tố bơ sữa', 40000, 8, true),
(2, 'Nước suối', 'Nước suối Lavie 500ml', 10000, 1, true),

-- Đồ ăn nhẹ
(3, 'Bánh mì thịt', 'Bánh mì thịt nướng', 35000, 10, true),
(3, 'Bánh croissant', 'Bánh croissant bơ', 25000, 5, true),
(3, 'Khoai tây chiên', 'Khoai tây chiên giòn', 30000, 12, true),

-- Cơm - Phở
(4, 'Cơm gà nướng', 'Cơm gà nướng mật ong', 85000, 25, true),
(4, 'Phở bò tái', 'Phở bò tái chín', 75000, 20, true),
(4, 'Bún bò Huế', 'Bún bò Huế cay', 70000, 20, true),

-- Tráng miệng
(5, 'Chè đậu xanh', 'Chè đậu xanh nước dừa', 25000, 5, true),
(5, 'Kem vani', 'Kem vani 2 viên', 20000, 2, true),
(5, 'Trái cây tươi', 'Dĩa trái cây theo mùa', 45000, 10, true)
ON CONFLICT DO NOTHING;