import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("authToken");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post("/auth/login", credentials),
  register: (userData) => api.post("/auth/register", userData),
};

// Rooms API
export const roomsAPI = {
  getAll: () => api.get("/rooms"),
  getById: (id) => api.get(`/rooms/${id}`),
  getByNumber: (roomNumber) => api.get(`/rooms/number/${roomNumber}`),
  getOrders: (id) => api.get(`/rooms/${id}/orders`),
};

// Menu API
export const menuAPI = {
  getAll: () => api.get("/menu"),
  getItem: (id) => api.get(`/menu/items/${id}`),
  getCategories: () => api.get("/menu/categories"),
  getCategoryItems: (categoryId) =>
    api.get(`/menu/categories/${categoryId}/items`),
};

// Orders API
export const ordersAPI = {
  create: (orderData) => api.post("/orders", orderData),
  getById: (id) => api.get(`/orders/${id}`),
  getAll: (params = {}) => api.get("/orders", { params }),
  updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data),
  getHistory: (id) => api.get(`/orders/${id}/history`),
};

// Admin API
export const adminAPI = {
  getDashboard: () => api.get("/admin/dashboard"),
  getMenuItems: () => api.get("/admin/menu/items"),
  createMenuItem: (data) => api.post("/admin/menu/items", data),
  updateMenuItem: (id, data) => api.put(`/admin/menu/items/${id}`, data),
  deleteMenuItem: (id) => api.delete(`/admin/menu/items/${id}`),
  getUsers: () => api.get("/admin/users"),
  updateUserRole: (id, data) => api.patch(`/admin/users/${id}/role`, data),
  getDailyReports: (params = {}) => api.get("/admin/reports/daily", { params }),
};

export default api;
