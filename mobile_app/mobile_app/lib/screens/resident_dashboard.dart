import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:intl/intl.dart';
import '../api/api_service.dart';

class ResidentDashboard extends StatefulWidget {
  final ApiService apiService;
  final VoidCallback onLogout;

  const ResidentDashboard({
    super.key,
    required this.apiService,
    required this.onLogout,
  });

  @override
  State<ResidentDashboard> createState() => _ResidentDashboardState();
}

class _ResidentDashboardState extends State<ResidentDashboard> {
  int _currentIndex = 0;
  bool _isLoading = true;
  String? _errorMessage;

  // Dashboard state variables loaded from backend API
  String _fullName = '';
  double _walletBalance = 0.0;
  double _totalBilled = 0.0;
  double _totalCollected = 0.0;
  List<dynamic> _ledgers = [];
  List<dynamic> _utilities = [];
  List<dynamic> _notices = [];
  List<dynamic> _polls = [];
  List<dynamic> _amenities = [];
  List<dynamic> _bookings = [];
  List<dynamic> _visitors = [];
  List<dynamic> _notifications = [];
  List<dynamic> _complaints = [];

  // Controllers for forms
  final _visitorNameCtrl = TextEditingController();
  final _visitorPhoneCtrl = TextEditingController();
  final _vehiclePlateCtrl = TextEditingController();
  String _visitorType = 'one_time';

  final _complaintTitleCtrl = TextEditingController();
  final _complaintDescCtrl = TextEditingController();
  String _complaintCategory = 'general';

  @override
  void initState() {
    super.initState();
    _fetchDashboardData();
  }

  Future<void> _fetchDashboardData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final data = await widget.apiService.getDashboard();
      setState(() {
        _fullName = data['fullName'] ?? '';
        final walletData = data['wallet'] ?? {};
        _walletBalance = ConvertToDouble(walletData['balance']);
        _totalBilled = ConvertToDouble(walletData['totalBilled']);
        _totalCollected = ConvertToDouble(walletData['totalCollected']);
        _ledgers = data['ledgers'] ?? [];
        _utilities = data['utilities'] ?? [];
        _notices = data['notices'] ?? [];
        _polls = data['polls'] ?? [];
        _amenities = data['amenities'] ?? [];
        _bookings = data['bookings'] ?? [];
        _visitors = data['visitors'] ?? [];
        _notifications = data['notifications'] ?? [];
        _complaints = data['complaints'] ?? [];
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  double ConvertToDouble(dynamic val) {
    if (val == null) return 0.0;
    if (val is num) return val.toDouble();
    return double.tryParse(val.toString()) ?? 0.0;
  }

  // Handle Poll Vote Submission
  Future<void> _handleVote(String pollId, String option) async {
    try {
      await widget.apiService.castVote(pollId, option);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Vote cast successfully')),
        );
      }
      _fetchDashboardData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
        );
      }
    }
  }

  // Handle Amenity Booking Submission
  Future<void> _handleBookAmenity(String amenityId) async {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    final bookingDate = DateFormat('yyyy-MM-dd').format(tomorrow);

    try {
      await widget.apiService.bookAmenity(
        amenityId: amenityId,
        bookingDate: bookingDate,
        startTime: '10:00:00',
        endTime: '12:00:00',
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Amenity booked for tomorrow ($bookingDate, 10:00 AM)')),
        );
      }
      _fetchDashboardData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Booking failed: $e')),
        );
      }
    }
  }

  // Create Visitor Pass
  Future<void> _handleCreateVisitorPass() async {
    final name = _visitorNameCtrl.text.trim();
    if (name.isEmpty) return;

    try {
      await widget.apiService.createVisitorPass(
        visitorName: name,
        visitorPhone: _visitorPhoneCtrl.text.trim(),
        visitorType: _visitorType,
        vehiclePlate: _vehiclePlateCtrl.text.trim(),
      );
      _visitorNameCtrl.clear();
      _visitorPhoneCtrl.clear();
      _vehiclePlateCtrl.clear();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Visitor pass pre-registered successfully')),
        );
      }
      _fetchDashboardData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    }
  }

  // Submit Complaint
  Future<void> _handleCreateComplaint() async {
    final title = _complaintTitleCtrl.text.trim();
    if (title.isEmpty) return;

    try {
      await widget.apiService.createComplaint(
        title: title,
        category: _complaintCategory,
        description: _complaintDescCtrl.text.trim(),
      );
      _complaintTitleCtrl.clear();
      _complaintDescCtrl.clear();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Complaint filed successfully')),
        );
      }
      _fetchDashboardData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    }
  }

  // Approve Visitor entry (mark read)
  Future<void> _handleApproveEntry(String notifId) async {
    try {
      await widget.apiService.markNotificationRead(notifId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Visitor Entry Approved')),
        );
      }
      _fetchDashboardData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Verification failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _fullName.isNotEmpty ? 'Welcome, $_fullName' : 'HousingOS Resident',
              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const Text(
              'Resident Dashboard',
              style: TextStyle(color: Colors.grey, fontSize: 11),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.blueAccent),
            onPressed: _fetchDashboardData,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.redAccent),
            onPressed: widget.onLogout,
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: const Color(0xFF1E293B),
        selectedItemColor: Colors.blueAccent,
        unselectedItemColor: Colors.grey,
        currentIndex: _currentIndex,
        onTap: (idx) => setState(() => _currentIndex = idx),
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.wallet), label: 'Wallet'),
          BottomNavigationBarItem(icon: Icon(Icons.people), label: 'Visitors'),
          BottomNavigationBarItem(icon: Icon(Icons.bolt), label: 'Utilities'),
          BottomNavigationBarItem(icon: Icon(Icons.campaign), label: 'Community'),
          BottomNavigationBarItem(icon: Icon(Icons.report_problem), label: 'Complaints'),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.blueAccent))
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent)),
                  ),
                )
              : _buildTabContent(),
    );
  }

  Widget _buildTabContent() {
    switch (_currentIndex) {
      case 0:
        return _buildWalletTab();
      case 1:
        return _buildVisitorsTab();
      case 2:
        return _buildUtilitiesTab();
      case 3:
        return _buildCommunityTab();
      case 4:
        return _buildComplaintsTab();
      default:
        return Container();
    }
  }

  // 1. Wallet & Ledger Tab
  Widget _buildWalletTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Card(
          color: const Color(0xFF1E293B),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'OUTSTANDING BALANCE',
                  style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),
                Text(
                  '\$${_walletBalance.toStringAsFixed(2)}',
                  style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Total Billed', style: TextStyle(color: Colors.grey, fontSize: 11)),
                        Text('\$${_totalBilled.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Total Paid', style: TextStyle(color: Colors.grey, fontSize: 11)),
                        Text('\$${_totalCollected.toStringAsFixed(2)}', style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          'Ledger Statements',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 10),
        ..._ledgers.map((l) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l['description'] ?? 'Ledger Entry', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                      Text('Due: ${l['due_date']?.toString().substring(0, 10) ?? ''}', style: const TextStyle(color: Colors.grey, fontSize: 11)),
                    ],
                  ),
                  Text(
                    '${l['entry_type'] == 'debit' ? '+' : '-'}\$${l['amount']}',
                    style: TextStyle(
                      color: l['entry_type'] == 'debit' ? Colors.redAccent : Colors.greenAccent,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            )),
      ],
    );
  }

  // 2. Visitor Passes Tab
  Widget _buildVisitorsTab() {
    // Check if there is any Visitor Entry Approval alert
    final approvalAlerts = _notifications.where((n) => n['type'] == 'visitor' && n['read_status'] == 'unread').toList();

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton(
        backgroundColor: Colors.blueAccent,
        onPressed: _showCreateVisitorPassDialog,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (approvalAlerts.isNotEmpty) ...[
            const Text(
              'Entry Approvals Required',
              style: TextStyle(color: Colors.amberAccent, fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            ...approvalAlerts.map((n) => Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.amber.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.amber.withOpacity(0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(n['message'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 13)),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: Colors.green, fixedSize: const Size(100, 32)),
                            onPressed: () => _handleApproveEntry(n['id']),
                            child: const Text('Approve', style: TextStyle(color: Colors.white, fontSize: 12)),
                          ),
                          const SizedBox(width: 10),
                          OutlinedButton(
                            style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.redAccent)),
                            onPressed: () => _handleApproveEntry(n['id']),
                            child: const Text('Deny', style: TextStyle(color: Colors.redAccent, fontSize: 12)),
                          ),
                        ],
                      ),
                    ],
                  ),
                )),
            const SizedBox(height: 20),
          ],
          const Text(
            'Active Gate Passes',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          _visitors.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Text('No visitor passes generated.', style: TextStyle(color: Colors.grey)),
                  ),
                )
              : GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 0.8,
                  ),
                  itemCount: _visitors.length,
                  itemBuilder: (context, idx) {
                    final pass = _visitors[idx];
                    return GestureDetector(
                      onTap: () => _showPassCodeDetails(pass),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            SizedBox(
                              height: 60,
                              width: 60,
                              child: QrImageView(
                                data: pass['pass_code'] ?? '000000',
                                version: QrVersions.auto,
                                eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Colors.white),
                                dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Colors.white),
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              pass['visitor_name'] ?? 'Visitor',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Code: ${pass['pass_code']}',
                              style: const TextStyle(color: Colors.blueAccent, fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              pass['vehicle_plate'] != null ? 'Vehicle: ${pass['vehicle_plate']}' : 'No vehicle',
                              style: const TextStyle(color: Colors.grey, fontSize: 10),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ],
      ),
    );
  }

  void _showPassCodeDetails(dynamic pass) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: Text(pass['visitor_name'], style: const TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              height: 140,
              width: 140,
              child: QrImageView(
                data: pass['pass_code'],
                version: QrVersions.auto,
                eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Colors.white),
                dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Colors.white),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Gate Code: ${pass['pass_code']}',
              style: const TextStyle(color: Colors.blueAccent, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text('Type: ${pass['visitor_type'] == 'recurring' ? 'Recurring Pass' : 'One Time Pass'}', style: const TextStyle(color: Colors.grey)),
            if (pass['vehicle_plate'] != null) Text('Vehicle Plate: ${pass['vehicle_plate']}', style: const TextStyle(color: Colors.grey)),
          ],
        ),
      ),
    );
  }

  void _showCreateVisitorPassDialog() {
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: const Text('New Gate Pass', style: TextStyle(color: Colors.white)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: _visitorNameCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'Visitor Name', labelStyle: TextStyle(color: Colors.grey)),
                ),
                TextField(
                  controller: _visitorPhoneCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'Visitor Phone (optional)', labelStyle: TextStyle(color: Colors.grey)),
                ),
                TextField(
                  controller: _vehiclePlateCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'Vehicle Plate (optional)', labelStyle: TextStyle(color: Colors.grey)),
                ),
                DropdownButtonFormField<String>(
                  value: _visitorType,
                  dropdownColor: const Color(0xFF1E293B),
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'Pass Type', labelStyle: TextStyle(color: Colors.grey)),
                  items: const [
                    DropdownMenuItem(value: 'one_time', child: Text('One Time')),
                    DropdownMenuItem(value: 'recurring', child: Text('Recurring')),
                  ],
                  onChanged: (val) => setDialogState(() => _visitorType = val!),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(onPressed: _handleCreateVisitorPass, child: const Text('Register')),
          ],
        ),
      ),
    );
  }

  // 3. Utilities Tab
  Widget _buildUtilitiesTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Utility Bills & Meter Readings',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 10),
        _utilities.isEmpty
            ? const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Text('No meter readings available.', style: TextStyle(color: Colors.grey))))
            : Column(
                children: _utilities.map((u) => Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '${u['meter_type'].toString().toUpperCase()} METER',
                                style: const TextStyle(color: Colors.blueAccent, fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                              Text(
                                'Reading: ${u['current_reading']} units',
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          const Divider(color: Colors.grey, height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Date: ${u['reading_date']?.toString().substring(0, 10) ?? ''}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                              Text('Billing Status: ${u['billing_status'] ?? 'Unbilled'}', style: TextStyle(color: u['billing_status'] == 'paid' ? Colors.greenAccent : Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ],
                      ),
                    )).toList(),
              ),
      ],
    );
  }

  // 5. Community tab & notice list
  Widget _buildCommunityTab() {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: const PreferredSize(
          preferredSize: Size.fromHeight(50),
          child: TabBar(
            labelColor: Colors.blueAccent,
            unselectedLabelColor: Colors.grey,
            indicatorColor: Colors.blueAccent,
            tabs: [
              Tab(text: 'Notices'),
              Tab(text: 'Polls'),
              Tab(text: 'Amenities'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _buildNoticeList(),
            _buildPollList(),
            _buildAmenityList(),
          ],
        ),
      ),
    );
  }

  Widget _buildNoticeList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _notices.length,
      itemBuilder: (context, idx) {
        final notice = _notices[idx];
        return Card(
          color: const Color(0xFF1E293B),
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(notice['title'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Text(notice['content'] ?? '', style: const TextStyle(color: Colors.grey, fontSize: 13)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildPollList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _polls.length,
      itemBuilder: (context, idx) {
        final poll = _polls[idx];
        final options = (poll['options_json'] != null) ? List<String>.from(poll['options_json']) : ['Yes', 'No'];
        final userVoted = poll['user_voted'] == 1;

        return Card(
          color: const Color(0xFF1E293B),
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(poll['question'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                const SizedBox(height: 10),
                ...options.map((opt) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: userVoted ? Colors.grey : Colors.blueAccent.withOpacity(0.2),
                          side: BorderSide(color: userVoted ? Colors.transparent : Colors.blueAccent),
                        ),
                        onPressed: userVoted ? null : () => _handleVote(poll['id'], opt),
                        child: Text(opt, style: const TextStyle(color: Colors.white)),
                      ),
                    )),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildAmenityList() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Available Facilities', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        ..._amenities.map((a) => Card(
              color: const Color(0xFF1E293B),
              child: ListTile(
                title: Text(a['name'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                subtitle: Text('Status: ${a['status']}', style: const TextStyle(color: Colors.grey)),
                trailing: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.blueAccent),
                  onPressed: () => _handleBookAmenity(a['id']),
                  child: const Text('Book', style: TextStyle(color: Colors.white)),
                ),
              ),
            )),
      ],
    );
  }

  // 5. Complaints Tab
  Widget _buildComplaintsTab() {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton(
        backgroundColor: Colors.blueAccent,
        onPressed: _showCreateComplaintDialog,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(20),
        itemCount: _complaints.length,
        itemBuilder: (context, idx) {
          final c = _complaints[idx];
          return Card(
            color: const Color(0xFF1E293B),
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c['title'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(c['category'] ?? '', style: const TextStyle(color: Colors.grey, fontSize: 11)),
                    ],
                  ),
                  Chip(
                    backgroundColor: c['status'] == 'open' ? Colors.amber.withOpacity(0.2) : Colors.green.withOpacity(0.2),
                    label: Text(c['status']?.toString().toUpperCase() ?? '', style: TextStyle(color: c['status'] == 'open' ? Colors.amber : Colors.green, fontSize: 10)),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _showCreateComplaintDialog() {
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: const Text('File Complaint', style: TextStyle(color: Colors.white)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _complaintTitleCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Title', labelStyle: TextStyle(color: Colors.grey)),
              ),
              TextField(
                controller: _complaintDescCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Details (optional)', labelStyle: TextStyle(color: Colors.grey)),
              ),
              DropdownButtonFormField<String>(
                value: _complaintCategory,
                dropdownColor: const Color(0xFF1E293B),
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(labelText: 'Category', labelStyle: TextStyle(color: Colors.grey)),
                items: const [
                  DropdownMenuItem(value: 'general', child: Text('General')),
                  DropdownMenuItem(value: 'plumbing', child: Text('Plumbing')),
                  DropdownMenuItem(value: 'electrical', child: Text('Electrical')),
                  DropdownMenuItem(value: 'security', child: Text('Security')),
                ],
                onChanged: (val) => setDialogState(() => _complaintCategory = val!),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(onPressed: _handleCreateComplaint, child: const Text('Submit')),
          ],
        ),
      ),
    );
  }
}
