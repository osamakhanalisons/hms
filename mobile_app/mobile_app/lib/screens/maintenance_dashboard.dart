import 'package:flutter/material.dart';
import '../api/api_service.dart';

class MaintenanceDashboard extends StatefulWidget {
  final ApiService apiService;
  final VoidCallback onLogout;

  const MaintenanceDashboard({
    super.key,
    required this.apiService,
    required this.onLogout,
  });

  @override
  State<MaintenanceDashboard> createState() => _MaintenanceDashboardState();
}

class _MaintenanceDashboardState extends State<MaintenanceDashboard> {
  bool _isLoading = true;
  String? _errorMessage;
  List<dynamic> _workOrders = [];

  final _costController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchWorkOrders();
  }

  Future<void> _fetchWorkOrders() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final data = await widget.apiService.getMaintenanceWorkOrders();
      setState(() {
        _workOrders = data;
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

  Future<void> _handleUpdateStatus(
    String orderId,
    String newStatus, {
    double? cost,
  }) async {
    setState(() {
      _isLoading = true;
    });

    try {
      await widget.apiService.updateWorkOrderStatus(
        orderId: orderId,
        status: newStatus,
        actualCost: cost,
      );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Work order updated to $newStatus')),
      );
      _fetchWorkOrders();
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Update failed: $e')));
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showResolveDialog(String orderId) {
    _costController.clear();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text(
          'Resolve Work Order',
          style: TextStyle(color: Colors.white),
        ),
        content: TextField(
          controller: _costController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'Actual Cost Incurred (\$)',
            labelStyle: TextStyle(color: Colors.grey),
            enabledBorder: UnderlineInputBorder(
              borderSide: BorderSide(color: Colors.grey),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            onPressed: () {
              final costVal =
                  double.tryParse(_costController.text.trim()) ?? 0.0;
              Navigator.pop(context);
              _handleUpdateStatus(orderId, 'resolved', cost: costVal);
            },
            child: const Text(
              'Resolve Job',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Maintenance Department',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              'Technician Jobs Tracker',
              style: TextStyle(color: Colors.grey, fontSize: 11),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.blueAccent),
            onPressed: _fetchWorkOrders,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.redAccent),
            onPressed: widget.onLogout,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Colors.blueAccent),
            )
          : _errorMessage != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: Colors.redAccent),
                ),
              ),
            )
          : _workOrders.isEmpty
          ? const Center(
              child: Text(
                'No assigned jobs available.',
                style: TextStyle(color: Colors.grey),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _workOrders.length,
              itemBuilder: (context, idx) {
                final job = _workOrders[idx];
                final status = job['status'] ?? 'pending';

                return Card(
                  color: const Color(0xFF1E293B),
                  margin: const EdgeInsets.only(bottom: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Order #${job['id'].toString().substring(0, 8).toUpperCase()}',
                              style: const TextStyle(
                                color: Colors.grey,
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                            Chip(
                              backgroundColor: status == 'resolved'
                                  ? Colors.green.withValues(alpha: 0.15)
                                  : status == 'in_progress'
                                  ? Colors.blue.withValues(alpha: 0.15)
                                  : Colors.amber.withValues(alpha: 0.15),
                              label: Text(
                                status
                                    .toString()
                                    .replaceAll('_', ' ')
                                    .toUpperCase(),
                                style: TextStyle(
                                  color: status == 'resolved'
                                      ? Colors.greenAccent
                                      : status == 'in_progress'
                                      ? Colors.blueAccent
                                      : Colors.amberAccent,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          job['title'] ?? 'Maintenance Request',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          job['description'] ?? '',
                          style: const TextStyle(
                            color: Colors.grey,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            const Icon(
                              Icons.home_outlined,
                              size: 14,
                              color: Colors.grey,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Unit: ${job['unit_number'] ?? 'N/A'}',
                              style: const TextStyle(
                                color: Colors.grey,
                                fontSize: 11,
                              ),
                            ),
                            const SizedBox(width: 16),
                            const Icon(
                              Icons.priority_high,
                              size: 14,
                              color: Colors.grey,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Priority: ${job['priority'] ?? 'normal'}',
                              style: const TextStyle(
                                color: Colors.grey,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                        if (status != 'resolved') ...[
                          const Divider(color: Colors.grey, height: 24),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              if (status == 'pending')
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.blueAccent,
                                  ),
                                  onPressed: () => _handleUpdateStatus(
                                    job['id'],
                                    'in_progress',
                                  ),
                                  child: const Text(
                                    'Start Work',
                                    style: TextStyle(color: Colors.white),
                                  ),
                                ),
                              if (status == 'in_progress')
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.green,
                                  ),
                                  onPressed: () =>
                                      _showResolveDialog(job['id']),
                                  child: const Text(
                                    'Complete Job',
                                    style: TextStyle(color: Colors.white),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
