import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String _tokenKey = 'session_token';
  static const String _hostKey = 'backend_host';

  // Default to standard Android emulator loopback. Can be overridden in Settings UI.
  String _baseUrl = 'http://10.0.2.2:3000/api/mobile';
  String? _token;

  String get baseUrl => _baseUrl;
  String? get token => _token;

  // Initialize service, load stored token and host
  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    final savedHost = prefs.getString(_hostKey);
    if (savedHost != null && savedHost.isNotEmpty) {
      _baseUrl = '$savedHost/api/mobile';
    }
  }

  // Update backend URL target
  Future<void> updateHost(String host) async {
    _baseUrl = '$host/api/mobile';
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_hostKey, host);
  }

  // Save session token locally
  Future<void> saveToken(String token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  // Clear local session token (logout)
  Future<void> logout() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  // Check authentication status
  bool get isAuthenticated => _token != null;

  // Helper for setting Authorization and content-type headers
  Map<String, String> _headers() {
    final headers = {
      'Content-Type': 'application/json',
    };
    if (_token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  // POST /login
  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      await saveToken(data['token']);
      return data;
    } else {
      throw Exception(data['error'] ?? 'Authentication failed');
    }
  }

  // GET /dashboard
  Future<Map<String, dynamic>> getDashboard() async {
    final response = await http.get(
      Uri.parse('$_baseUrl/dashboard'),
      headers: _headers(),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to load dashboard: ${response.body}');
    }
  }

  // POST /visitor-passes
  Future<Map<String, dynamic>> createVisitorPass({
    required String visitorName,
    String? visitorPhone,
    String? expectedAt,
    String? visitorType,
    String? vehiclePlate,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/visitor-passes'),
      headers: _headers(),
      body: jsonEncode({
        'visitorName': visitorName,
        'visitorPhone': visitorPhone,
        'expectedAt': expectedAt,
        'visitorType': visitorType,
        'vehiclePlate': vehiclePlate,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to create visitor pass: ${response.body}');
    }
  }

  // POST /complaints
  Future<Map<String, dynamic>> createComplaint({
    required String title,
    required String category,
    String? description,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/complaints'),
      headers: _headers(),
      body: jsonEncode({
        'title': title,
        'category': category,
        'description': description,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to log complaint: ${response.body}');
    }
  }

  // POST /polls/vote
  Future<bool> castVote(String pollId, String optionSelected) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/polls/vote'),
      headers: _headers(),
      body: jsonEncode({
        'pollId': pollId,
        'optionSelected': optionSelected,
      }),
    );

    if (response.statusCode == 200) {
      return true;
    } else {
      final data = jsonDecode(response.body);
      throw Exception(data['error'] ?? 'Failed to cast vote');
    }
  }

  // POST /amenities/book
  Future<Map<String, dynamic>> bookAmenity({
    required String amenityId,
    required String bookingDate,
    required String startTime,
    required String endTime,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/amenities/book'),
      headers: _headers(),
      body: jsonEncode({
        'amenityId': amenityId,
        'bookingDate': bookingDate,
        'startTime': startTime,
        'endTime': endTime,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to book amenity: ${response.body}');
    }
  }

  // POST /notifications/read
  Future<bool> markNotificationRead(String notificationId) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/notifications/read'),
      headers: _headers(),
      body: jsonEncode({'notificationId': notificationId}),
    );

    return response.statusCode == 200;
  }

  // GET /maintenance/work-orders
  Future<List<dynamic>> getMaintenanceWorkOrders() async {
    final response = await http.get(
      Uri.parse('$_baseUrl/maintenance/work-orders'),
      headers: _headers(),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body) as List<dynamic>;
    } else {
      throw Exception('Failed to fetch work orders: ${response.body}');
    }
  }

  // POST /maintenance/work-orders/update
  Future<bool> updateWorkOrderStatus({
    required String orderId,
    required String status,
    double? actualCost,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/maintenance/work-orders/update'),
      headers: _headers(),
      body: jsonEncode({
        'orderId': orderId,
        'status': status,
        'actualCost': actualCost,
      }),
    );

    return response.statusCode == 200;
  }
}
