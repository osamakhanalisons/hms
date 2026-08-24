import 'package:flutter/material.dart';
import 'api/api_service.dart';
import 'screens/login_screen.dart';
import 'screens/resident_dashboard.dart';
import 'screens/maintenance_dashboard.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final apiService = ApiService();
  await apiService.init();

  runApp(HousingOSApp(apiService: apiService));
}

class HousingOSApp extends StatefulWidget {
  final ApiService apiService;

  const HousingOSApp({super.key, required this.apiService});

  @override
  State<HousingOSApp> createState() => _HousingOSAppState();
}

class _HousingOSAppState extends State<HousingOSApp> {
  bool _isAuthenticated = false;
  String _userRole = 'resident'; // Default role: resident, tenant, or maintenance/vendor/staff

  @override
  void initState() {
    super.initState();
    _checkAuthentication();
  }

  void _checkAuthentication() {
    setState(() {
      _isAuthenticated = widget.apiService.isAuthenticated;
      // Note: role could be fetched dynamically from local preference or API on startup
    });
  }

  void _handleLoginSuccess() async {
    // Recheck session data after successful login
    setState(() {
      _isAuthenticated = true;
      // In mock/test environments, parse role directly from preferences/API
    });
    // Fetch dashboard info once to set correct role
    try {
      final data = await widget.apiService.getDashboard();
      setState(() {
        _userRole = data['role'] ?? 'resident';
      });
    } catch (e) {
      // Fallback
    }
  }

  void _handleLogout() async {
    await widget.apiService.logout();
    setState(() {
      _isAuthenticated = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HousingOS Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: Colors.blueAccent,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        fontFamily: 'Roboto',
      ),
      home: _isAuthenticated
          ? (_userRole == 'society_admin' || _userRole == 'super_admin'
              ? MaintenanceDashboard(
                  apiService: widget.apiService,
                  onLogout: _handleLogout,
                )
              : ResidentDashboard(
                  apiService: widget.apiService,
                  onLogout: _handleLogout,
                ))
          : LoginScreen(
              apiService: widget.apiService,
              onLoginSuccess: _handleLoginSuccess,
            ),
    );
  }
}
