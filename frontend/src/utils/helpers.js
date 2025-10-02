export const formatCurrency = (amount) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

export const formatDate = (date) => {
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

export const formatTime = (date) => {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

export const getStatusColor = (status) => {
  const colors = {
    pending: "bg-yellow-100 text-yellow-800",
    preparing: "bg-blue-100 text-blue-800",
    ready: "bg-green-100 text-green-800",
    delivered: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
};

export const getStatusText = (status) => {
  const texts = {
    pending: "Chờ xử lý",
    preparing: "Đang chuẩn bị",
    ready: "Sẵn sàng",
    delivered: "Đã giao",
    cancelled: "Đã hủy",
  };
  return texts[status] || status;
};

export const getRoomFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("room");
};

export const generateQRCodeUrl = (roomNumber) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/order?room=${roomNumber}`;
};
