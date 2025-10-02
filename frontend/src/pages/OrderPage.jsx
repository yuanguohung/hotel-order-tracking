import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { menuAPI, ordersAPI, roomsAPI } from "../utils/api";
import { formatCurrency } from "../utils/helpers";
import { ShoppingCart, Plus, Minus, Check, AlertCircle } from "lucide-react";

const OrderPage = () => {
  const [searchParams] = useSearchParams();
  const roomNumber = searchParams.get("room");

  const [room, setRoom] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
  });
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (roomNumber) {
      loadData();
    } else {
      setError("Mã phòng không hợp lệ");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomNumber]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load room info
      const roomResponse = await roomsAPI.getByNumber(roomNumber);
      setRoom(roomResponse.data.data);

      // Load menu
      const menuResponse = await menuAPI.getAll();
      setMenu(menuResponse.data.data);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Không thể tải dữ liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (menuItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === menuItem.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, { ...menuItem, quantity: 1, specialRequests: "" }];
      }
    });
  };

  const removeFromCart = (menuItemId) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) =>
          item.id === menuItemId
            ? { ...item, quantity: Math.max(0, item.quantity - 1) }
            : item
        )
        .filter((item) => item.quantity > 0);
    });
  };

  const updateCartItemSpecialRequests = (menuItemId, specialRequests) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === menuItemId ? { ...item, specialRequests } : item
      )
    );
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    if (cart.length === 0) {
      setError("Vui lòng chọn ít nhất một món");
      return;
    }

    if (!customerInfo.name.trim()) {
      setError("Vui lòng nhập tên khách hàng");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const orderData = {
        roomId: room.id,
        customerName: customerInfo.name.trim(),
        customerPhone: customerInfo.phone.trim(),
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
          specialRequests: item.specialRequests,
        })),
        specialInstructions: specialInstructions.trim(),
      };

      await ordersAPI.create(orderData);

      setSuccess(true);
      setCart([]);
      setCustomerInfo({ name: "", phone: "" });
      setSpecialInstructions("");

      // Auto hide success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      console.error("Error creating order:", error);
      setError(error.response?.data?.error || "Có lỗi xảy ra khi đặt hàng");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải menu...</p>
        </div>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Lỗi</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Order - Phòng {room?.room_number}
                </h1>
                <p className="text-gray-600">Tầng {room?.floor_number}</p>
              </div>
              <div className="relative">
                <ShoppingCart className="h-8 w-8 text-primary-600" />
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cart.reduce((total, item) => total + item.quantity, 0)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 m-4">
          <div className="flex">
            <Check className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Đặt hàng thành công! Đơn hàng của bạn đang được xử lý.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 m-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Menu */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Menu</h2>

            {menu.map((category) => (
              <div key={category.id} className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {category.name}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {category.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col justify-end bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
                    >
                      {/* Menu Item Image */}
                      {item.image_url && (
                        <div className="h-48 w-full overflow-hidden">
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900">
                            {item.name}
                          </h4>
                          <span className="text-primary-600 font-semibold">
                            {formatCurrency(item.price)}
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-sm text-gray-600 mb-3">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {item.preparation_time} phút
                          </span>

                          <div className="flex items-center space-x-2">
                            {cart.find((cartItem) => cartItem.id === item.id) ? (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="font-medium">
                                  {
                                    cart.find(
                                      (cartItem) => cartItem.id === item.id
                                    )?.quantity
                                  }
                                </span>
                                <button
                                  onClick={() => addToCart(item)}
                                  className="bg-blue-100 text-blue-600 rounded-full p-1 hover:bg-blue-200"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(item)}
                                className="btn-primary text-sm"
                              >
                                Thêm
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Cart & Order Form */}
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-24">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Đơn hàng của bạn
              </h3>

              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Chưa có món nào được chọn
                </p>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-start"
                      >
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{item.name}</h4>
                          <p className="text-xs text-gray-600">
                            {formatCurrency(item.price)} x {item.quantity}
                          </p>
                          <input
                            type="text"
                            placeholder="Yêu cầu đặc biệt..."
                            value={item.specialRequests}
                            onChange={(e) =>
                              updateCartItemSpecialRequests(
                                item.id,
                                e.target.value
                              )
                            }
                            className="mt-1 text-xs border border-gray-300 rounded px-2 py-1 w-full"
                          />
                        </div>
                        <div className="text-right ml-2">
                          <p className="font-medium text-sm">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 text-xs hover:text-red-700 mt-1"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 mb-4">
                    <div className="flex justify-between items-center font-semibold">
                      <span>Tổng cộng:</span>
                      <span className="text-primary-600">
                        {formatCurrency(getTotalAmount())}
                      </span>
                    </div>
                  </div>
                </>
              )}

              <form onSubmit={handleSubmitOrder} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên khách hàng *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerInfo.name}
                    onChange={(e) =>
                      setCustomerInfo((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Nhập tên của bạn"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) =>
                      setCustomerInfo((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Nhập số điện thoại"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ghi chú đặc biệt
                  </label>
                  <textarea
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    rows="3"
                    placeholder="Ghi chú thêm cho đơn hàng..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || cart.length === 0}
                  className="w-full btn-primary"
                >
                  {submitting ? "Đang đặt hàng..." : "Đặt hàng"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderPage;
