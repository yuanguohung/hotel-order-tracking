import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const RoomManagementPage = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [roomForm, setRoomForm] = useState({
    room_number: '',
    floor_number: '',
    status: 'available'
  });

  const statusOptions = [
    { value: 'available', label: 'Trống', color: 'bg-green-100 text-green-800' },
    { value: 'occupied', label: 'Có khách', color: 'bg-blue-100 text-blue-800' },
    { value: 'maintenance', label: 'Bảo trì', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'cleaning', label: 'Dọn dẹp', color: 'bg-purple-100 text-purple-800' },
    { value: 'out_of_order', label: 'Hỏng', color: 'bg-red-100 text-red-800' }
  ];

  const statusColors = {
    available: 'bg-green-100 text-green-800',
    occupied: 'bg-blue-100 text-blue-800',
    maintenance: 'bg-yellow-100 text-yellow-800',
    cleaning: 'bg-purple-100 text-purple-800',
    out_of_order: 'bg-red-100 text-red-800'
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await api.get('/rooms');
      if (response.data.success) {
        setRooms(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      alert('Lỗi khi lấy danh sách phòng');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingRoom ? `/rooms/${editingRoom.id}` : '/rooms';
      const method = editingRoom ? 'put' : 'post';

      const response = await api[method](url, roomForm);

      if (response.data.success) {
        alert(editingRoom ? 'Cập nhật phòng thành công!' : 'Tạo phòng thành công!');
        setShowModal(false);
        resetForm();
        fetchRooms();
      }
    } catch (error) {
      console.error('Error saving room:', error);
      const errorMessage = error.response?.data?.error || 'Lỗi khi lưu thông tin phòng';
      alert(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa phòng này?')) return;

    try {
      const response = await api.delete(`/rooms/${id}`);
      if (response.data.success) {
        alert('Xóa phòng thành công!');
        fetchRooms();
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      const errorMessage = error.response?.data?.error || 'Lỗi khi xóa phòng';
      alert(errorMessage);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedRooms.length === 0 || !bulkStatus) {
      alert('Vui lòng chọn phòng và trạng thái');
      return;
    }

    try {
      const response = await api.patch('/rooms/bulk-status', {
        room_ids: selectedRooms,
        status: bulkStatus
      });

      if (response.data.success) {
        alert(`Đã cập nhật trạng thái cho ${response.data.data.length} phòng!`);
        setSelectedRooms([]);
        setBulkStatus('');
        fetchRooms();
      }
    } catch (error) {
      console.error('Error bulk updating rooms:', error);
      alert('Lỗi khi cập nhật hàng loạt');
    }
  };

  const resetForm = () => {
    setRoomForm({
      room_number: '',
      floor_number: '',
      status: 'available'
    });
    setEditingRoom(null);
  };

  const openModal = (room = null) => {
    if (room) {
      setRoomForm({
        room_number: room.room_number,
        floor_number: room.floor_number.toString(),
        status: room.status
      });
      setEditingRoom(room);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSelectRoom = (roomId) => {
    setSelectedRooms(prev => 
      prev.includes(roomId) 
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const handleSelectAll = () => {
    if (selectedRooms.length === rooms.length) {
      setSelectedRooms([]);
    } else {
      setSelectedRooms(rooms.map(room => room.id));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  // Group rooms by floor for better visualization
  const roomsByFloor = rooms.reduce((acc, room) => {
    const floor = room.floor_number;
    if (!acc[floor]) {
      acc[floor] = [];
    }
    acc[floor].push(room);
    return acc;
  }, {});

  const sortedFloors = Object.keys(roomsByFloor).sort((a, b) => parseInt(a) - parseInt(b));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Đang tải...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Quản lý phòng</h1>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + Thêm phòng
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {statusOptions.map(status => {
          const count = rooms.filter(room => room.status === status.value).length;
          return (
            <div key={status.value} className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center">
                <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                  {status.label}
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-gray-900">
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk Actions */}
      {selectedRooms.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold mb-3">
            Cập nhật hàng loạt ({selectedRooms.length} phòng)
          </h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trạng thái mới
              </label>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Chọn trạng thái</option>
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleBulkStatusUpdate}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cập nhật
            </button>
          </div>
        </div>
      )}

      {/* Rooms by Floor */}
      <div className="space-y-6">
        {sortedFloors.map(floor => (
          <div key={floor} className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold">
                Tầng {floor} ({roomsByFloor[floor].length} phòng)
              </h3>
            </div>
            
            {/* Room Grid for each floor */}
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {roomsByFloor[floor]
                  .sort((a, b) => a.room_number.localeCompare(b.room_number))
                  .map(room => (
                  <div key={room.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="checkbox"
                        checked={selectedRooms.includes(room.id)}
                        onChange={() => handleSelectRoom(room.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-lg font-bold text-gray-900">
                        {room.room_number}
                      </span>
                    </div>
                    
                    <div className="mb-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[room.status] || 'bg-gray-100 text-gray-800'}`}>
                        {statusOptions.find(s => s.value === room.status)?.label || room.status}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-500 mb-3">
                      <div>Tạo: {formatDate(room.created_at)}</div>
                      {room.updated_at !== room.created_at && (
                        <div>Cập nhật: {formatDate(room.updated_at)}</div>
                      )}
                    </div>
                    
                    <div className="flex justify-between">
                      <button
                        onClick={() => openModal(room)}
                        className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(room.id)}
                        className="text-red-600 hover:text-red-900 text-sm font-medium"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Table View */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedRooms.length === rooms.length && rooms.length > 0}
                onChange={handleSelectAll}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <h3 className="text-lg font-semibold">
                Chi tiết tất cả phòng ({rooms.length})
              </h3>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Số phòng
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tầng
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  QR Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tạo lúc
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRooms.includes(room.id)}
                      onChange={() => handleSelectRoom(room.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {room.room_number}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {room.floor_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[room.status] || 'bg-gray-100 text-gray-800'}`}>
                      {statusOptions.find(s => s.value === room.status)?.label || room.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {room.qr_code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(room.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openModal(room)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(room.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingRoom ? 'Sửa phòng' : 'Thêm phòng mới'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số phòng *
                  </label>
                  <input
                    type="text"
                    required
                    value={roomForm.room_number}
                    onChange={(e) => setRoomForm(prev => ({ ...prev, room_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ví dụ: 101, A201"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tầng *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={roomForm.floor_number}
                    onChange={(e) => setRoomForm(prev => ({ ...prev, floor_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trạng thái *
                  </label>
                  <select
                    required
                    value={roomForm.status}
                    onChange={(e) => setRoomForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {editingRoom ? 'Cập nhật' : 'Tạo mới'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomManagementPage;