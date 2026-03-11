import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:qr_code_scanner/qr_code_scanner.dart';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<String> getDeviceId() async {
  final deviceInfo = DeviceInfoPlugin();
  try {
    if (kIsWeb) {
      final webInfo = await deviceInfo.webBrowserInfo;
      // Combine some web props as a persistent-ish ID for test purposes
      return "${webInfo.vendor ?? 'Unknown'}-${webInfo.userAgent ?? 'Web'}";
    } else {
      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        return androidInfo.id;
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        return iosInfo.identifierForVendor ?? 'UNKNOWN_IOS';
      }
    }
  } catch (e) {
    debugPrint('Device ID fetch error: $e');
  }
  return 'FALLBACK_DEVICE_${DateTime.now().millisecondsSinceEpoch}';
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    if (kIsWeb) {
      await Firebase.initializeApp(
        options: const FirebaseOptions(
          apiKey: "AIzaSyDANmS3qiOr1rCEeEV3jhpUVc4YAlCWHag",
          appId: "1:483886734852:web:f663454d8e47e65cdf9f51",
          messagingSenderId: "483886734852",
          projectId: "qr-ile-yoklama",
        ),
      );
    } else {
      await Firebase.initializeApp();
    }
  } catch (e) {
    debugPrint("Firebase init error: $e");
  }
  runApp(const AttendanceApp());
}

class AttendanceApp extends StatelessWidget {
  const AttendanceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ZBEÜ Yoklama',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      home: const LoginScreen(),
    );
  }
}

// ------------------- LOGIN SCREEN -------------------
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController emailController = TextEditingController(text: 'ali.veli@ogrenci.edu.tr');
  final TextEditingController passController = TextEditingController(text: 'ogrenci123');
  bool _obscureText = true;
  bool _isLoading = false;

  void login() async {
    setState(() {
      _isLoading = true;
    });
    try {
      // 1. Authenticate with Firebase Auth
      UserCredential userCredential = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: emailController.text.trim(),
        password: passController.text.trim(),
      );
      
      String? idToken = await userCredential.user?.getIdToken();
      if (idToken == null) throw Exception("Token alınamadı.");

      String deviceId = await getDeviceId();
      String deviceModel = kIsWeb ? 'Web Browser' : Platform.operatingSystem;

      // 2. Call our backend to verify token and register device
      String url = kIsWeb ? 'http://127.0.0.1:5000/api/auth/login' : 'http://10.0.2.2:5000/api/auth/login';
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'idToken': idToken,
          'device_id': deviceId,
          'device_model': deviceModel,
        }),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final String studentId = data['data']['user_id'] ?? 'STUDENT101';
        
        // Save user info for Profile screen
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user_name', data['data']['name'] ?? 'İsimsiz Öğrenci');
        await prefs.setString('user_email', data['data']['email'] ?? emailController.text);

        // Phase 4: Register FCM Token for Push Notifications
        try {
          if (!kIsWeb) {
             FirebaseMessaging messaging = FirebaseMessaging.instance;
             NotificationSettings settings = await messaging.requestPermission();
             
             if (settings.authorizationStatus == AuthorizationStatus.authorized) {
                 String? token = await messaging.getToken();
                 if (token != null) {
                    String tokenUrl = 'http://10.0.2.2:5000/api/notifications/register-token';
                    await http.post(
                       Uri.parse(tokenUrl),
                       headers: {'Content-Type': 'application/json'},
                       body: json.encode({'user_id': studentId, 'fcm_token': token}),
                    );
                 }
             }
          }
        } catch (e) {
           debugPrint("FCM token registration error: $e");
        }

        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => DashboardScreen(studentId: studentId)),
        );
      } else {
        print("Raw Backend Response: ${response.body}"); // FORCED PRINT
        final errorData = json.decode(response.body);
        debugPrint("Login failed with status ${response.statusCode}: ${response.body}");
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: ${errorData['message'] ?? 'Giriş Başarısız'}')));
      }
    } on FirebaseAuthException catch (e) {
      debugPrint("FirebaseAuthException: ${e.code} - ${e.message}");
      String message = "Giriş Hatası: ${e.code}";
      if (e.code == 'user-not-found') message = "Kullanıcı bulunamadı.";
      else if (e.code == 'wrong-password') message = "Hatalı şifre.";
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    } catch (e) {
      debugPrint("General Exception during login: $e");
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Sistem Hatası: $e')));
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA), // Very light gray from screenshot
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Logo placeholder (simulating ZBEÜ logo)
                Center(
                  child: Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                      border: Border.all(color: Colors.red, width: 3),
                    ),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.menu_book, color: Colors.green.shade600, size: 40),
                          const SizedBox(height: 4),
                          const Text('1924', style: TextStyle(color: Colors.red, fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                
                // Titles
                const Text(
                  'Tekrar Hoş Geldiniz (v2)',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Yoklama takibi uygulamasına giriş\nyapmak için bilgilerinizi girin.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    color: Color(0xFF64748B),
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 40),

                // Username Field
                const Text(
                  'Kullanıcı Adı',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: emailController,
                  decoration: InputDecoration(
                    hintText: 'Kullanıcı adınızı girin',
                    hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFF3B82F6), width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Password Field
                const Text(
                  'Şifre',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: passController,
                  obscureText: _obscureText,
                  decoration: InputDecoration(
                    hintText: 'Şifrenizi girin',
                    hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFF3B82F6), width: 1.5),
                    ),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscureText ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        color: const Color(0xFF64748B),
                      ),
                      onPressed: () {
                        setState(() {
                          _obscureText = !_obscureText;
                        });
                      },
                    ),
                  ),
                ),
                
                // Forgot Password
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () {
                      final resetEmailController = TextEditingController(text: emailController.text);
                      showDialog(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Şifremi Unuttum'),
                          content: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text('Kayıtlı e-posta adresinizi girin, size bir şifre sıfırlama bağlantısı göndereceğiz.'),
                              const SizedBox(height: 16),
                              TextField(
                                controller: resetEmailController,
                                decoration: const InputDecoration(
                                  labelText: 'E-Posta',
                                  border: OutlineInputBorder(),
                                ),
                                keyboardType: TextInputType.emailAddress,
                              ),
                            ],
                          ),
                          actions: [
                            TextButton(onPressed: () => Navigator.pop(context), child: const Text('İptal')),
                            ElevatedButton(
                              onPressed: () async {
                                try {
                                  await FirebaseAuth.instance.sendPasswordResetEmail(email: resetEmailController.text.trim());
                                  Navigator.pop(context);
                                  ScaffoldMessenger.of(this.context).showSnackBar(
                                    const SnackBar(content: Text('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.')),
                                  );
                                } catch (e) {
                                  ScaffoldMessenger.of(this.context).showSnackBar(
                                    SnackBar(content: Text('Hata: $e')),
                                  );
                                }
                              },
                              child: const Text('Gönder'),
                            ),
                          ],
                        ),
                      );
                    },
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(50, 30),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text(
                      'Şifremi Unuttum?',
                      style: TextStyle(
                        color: Color(0xFF2563EB),
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.underline,
                        decorationColor: Color(0xFF2563EB),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 32),

                // Login Button
                ElevatedButton(
                  onPressed: _isLoading ? null : login,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1D4ED8), // Vivid blue
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    elevation: 0,
                  ),
                  child: _isLoading 
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Giriş Yap', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ------------------- DASHBOARD SCREEN -------------------
class DashboardScreen extends StatefulWidget {
  final String studentId;
  const DashboardScreen({super.key, required this.studentId});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 1; // Default to 'Derslerim'

  Future<List<dynamic>> _fetchSchedule() async {
    try {
      String url = kIsWeb ? 'http://localhost:5000/api/student/${widget.studentId}/schedule' : 'http://10.0.2.2:5000/api/student/${widget.studentId}/schedule';
      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        return json.decode(response.body)['data']['schedule'] ?? [];
      }
    } catch (e) {
      debugPrint("Schedule fetch error: $e");
    }
    return [];
  }

  Future<List<dynamic>> _fetchCourses() async {
    try {
      String url = kIsWeb ? 'http://localhost:5000/api/student/${widget.studentId}/dashboard' : 'http://10.0.2.2:5000/api/student/${widget.studentId}/dashboard';
      final response = await http.get(Uri.parse(url));
      if (response.statusCode == 200) {
        return json.decode(response.body)['data']['courses'] ?? [];
      }
    } catch (e) {
      debugPrint("Courses fetch error: $e");
    }
    return [];
  }

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  void _showChangePasswordDialog(BuildContext context) {
    final TextEditingController newPassController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Şifre Değiştir'),
        content: TextField(
          controller: newPassController,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'Yeni Şifre',
            hintText: 'En az 6 karakter girin',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('İptal')),
          ElevatedButton(
            onPressed: () async {
              if (newPassController.text.length < 6) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Şifre en az 6 karakter olmalıdır.')));
                return;
              }
              try {
                await FirebaseAuth.instance.currentUser?.updatePassword(newPassController.text);
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Şifre başarıyla güncellendi.')));
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Hata: $e')));
              }
            },
            child: const Text('Güncelle'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Define titles for the AppBar based on selected index
    final List<String> tabTitles = ['Ana Sayfa', 'Derslerim', 'Duyurular', 'Profil'];
    final String currentTitle = _selectedIndex < tabTitles.length ? tabTitles[_selectedIndex] : 'Derslerim';
    return Scaffold(
      backgroundColor: const Color(0xFFF5F6F8), // Light grey background
      appBar: AppBar(
        title: Text(currentTitle, style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
      ),
      body: _buildBody(),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => QRScannerScreen(studentId: widget.studentId)),
          );
        },
        backgroundColor: const Color(0xFFE3EDF7),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        child: const Icon(Icons.qr_code_scanner, color: Colors.black54),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 8.0,
        color: Colors.white,
        surfaceTintColor: Colors.white,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildNavItem(Icons.home_outlined, 'Ana Sayfa', 0),
            _buildNavItem(Icons.menu_book, 'Derslerim', 1),
            const SizedBox(width: 48), // Space for FAB
            _buildNavItem(Icons.campaign_outlined, 'Duyurular', 2),
            _buildNavItem(Icons.person_outline, 'Profil', 3),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_selectedIndex == 0) {
      return FutureBuilder<List<dynamic>>(
        future: _fetchSchedule(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final schedule = snapshot.data ?? [];
          if (schedule.isEmpty) {
            return const Center(child: Text("Yaklaşan ders bulunmuyor."));
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text(
                'Yaklaşan Dersler (Dinamik)', 
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
              ),
              const SizedBox(height: 16),
              ...schedule.map((item) => UpcomingClassCard(
                time: item['time'] ?? '',
                title: item['title'] ?? '',
                instructor: item['instructor'] ?? '',
                classroom: item['classroom'] ?? '',
                isNow: item['isNow'] ?? false,
              )).toList(),
              const SizedBox(height: 80), // Padding for bottom nav
            ],
          );
        }
      );
    } else if (_selectedIndex == 2) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.campaign, size: 64, color: Colors.amber),
            SizedBox(height: 16),
            Text('Duyurular', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text('Henüz yeni bir duyuru yok.', style: TextStyle(color: Colors.grey)),
          ],
        ),
      );
    } else if (_selectedIndex == 3) {
      return FutureBuilder<Map<String, String>>(
        future: () async {
          final prefs = await SharedPreferences.getInstance();
          return {
            'name': prefs.getString('user_name') ?? 'Öğrenci',
            'email': prefs.getString('user_email') ?? 'e-posta yok',
          };
        }(),
        builder: (context, snapshot) {
          final name = snapshot.data?['name'] ?? 'Yükleniyor...';
          final email = snapshot.data?['email'] ?? '';
          
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const CircleAvatar(radius: 40, backgroundColor: Color(0xFF1D4ED8), child: Icon(Icons.person, size: 40, color: Colors.white)),
                const SizedBox(height: 16),
                Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                Text(email, style: const TextStyle(color: Colors.grey)),
                const SizedBox(height: 32),
                
                // Change Password Button
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  child: ElevatedButton.icon(
                    onPressed: () => _showChangePasswordDialog(context),
                    icon: const Icon(Icons.lock_outline, size: 18),
                    label: const Text('Şifre Değiştir'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.blue.shade700,
                      side: BorderSide(color: Colors.blue.shade100),
                      minimumSize: const Size(double.infinity, 50),
                      elevation: 0,
                    ),
                  ),
                ),
                
                const SizedBox(height: 12),
                
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      await FirebaseAuth.instance.signOut();
                      Navigator.pushReplacement(context, MaterialPageRoute(builder: (context) => const LoginScreen()));
                    },
                    icon: const Icon(Icons.logout, size: 18),
                    label: const Text('Güvenli Çıkış Yap'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.shade50,
                      foregroundColor: Colors.red,
                      minimumSize: const Size(double.infinity, 50),
                      elevation: 0,
                    ),
                  ),
                )
              ],
            ),
          );
        }
      );
    }

    // Default: Derslerim (_selectedIndex == 1)
    return FutureBuilder<List<dynamic>>(
      future: _fetchCourses(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
           return const Center(child: CircularProgressIndicator());
        }
        final courses = snapshot.data ?? [];
        if (courses.isEmpty) {
           return const Center(child: Text("Kayıtlı dersiniz bulunmuyor."));
        }
        
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ...courses.map((c) => CourseSummaryCard(
              title: c['title'] ?? '',
              attended: c['total_absences'] == null ? 0 : (c['total_absences'] * -1) + c['absence_limit'] + 2, // Dummy total to match UI since backend returns percentages/absences, we'll adapt CourseSummaryCard slightly 
              total: c['absence_limit'] != null ? c['absence_limit'] + 5 : 8,
              instructor: c['instructor'] ?? '',
              nextClassTime: c['next_class_time'] ?? '',
              classroom: c['classroom'] ?? '',
              customPercentage: c['attendance_percentage'],
              customStatus: c['status'],
              customColorStr: c['color'],
            )).toList(),
            const SizedBox(height: 80), // Padding for bottom nav
          ],
        );
      }
    );
  }

  Widget _buildNavItem(IconData icon, String label, int index) {
    final isSelected = _selectedIndex == index;
    return InkWell(
      onTap: () => _onItemTapped(index),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: isSelected ? Colors.blue : Colors.grey),
          Text(label, style: TextStyle(fontSize: 10, color: isSelected ? Colors.blue : Colors.grey)),
        ],
      ),
    );
  }
}

class CourseSummaryCard extends StatelessWidget {
  final String title;
  final int attended;
  final int total;
  final String instructor;
  final String nextClassTime;
  final String classroom;
  final int? customPercentage;
  final String? customStatus;
  final String? customColorStr;

  const CourseSummaryCard({
    super.key, 
    required this.title, 
    required this.attended, 
    required this.total,
    required this.instructor,
    required this.nextClassTime,
    required this.classroom,
    this.customPercentage,
    this.customStatus,
    this.customColorStr,
  });

  void _showCourseDetails(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const Divider(height: 30),
              _buildDetailRow(Icons.person, 'Öğretmen', instructor),
              const SizedBox(height: 16),
              _buildDetailRow(Icons.access_time, 'Bir Dahaki Ders', nextClassTime),
              const SizedBox(height: 16),
              _buildDetailRow(Icons.room, 'Sınıf', classroom),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1D4ED8),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Kapat', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              )
            ],
          ),
        );
      },
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: Colors.blue.shade700, size: 24),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    double percentage = total > 0 ? (attended / total) : 0;
    int percentageInt = customPercentage ?? (percentage * 100).round();
    
    // Choose color based on attendance (e.g., < 60% is red)
    Color progressColor;
    if (customColorStr == 'green') progressColor = Colors.green.shade600;
    else if (customColorStr == 'red') progressColor = Colors.red.shade600;
    else if (customColorStr == 'orange') progressColor = Colors.orange.shade700;
    else progressColor = percentage < 0.6 ? Colors.red : const Color(0xFF3B5998);

    String statusText = customStatus ?? '$attended / $total katılım';

    return Card(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200, width: 1),
      ),
      child: InkWell(
        onTap: () => _showCourseDetails(context),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(statusText, style: TextStyle(fontSize: 11, color: progressColor, fontWeight: FontWeight.bold)),
                  Text('%$percentageInt', style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: percentageInt / 100,
                  backgroundColor: Colors.grey.shade200,
                  color: progressColor,
                  minHeight: 6,
                ),
              )
            ],
          ),
        ),
      ),
    );
  }
}

class UpcomingClassCard extends StatelessWidget {
  final String time;
  final String title;
  final String instructor;
  final String classroom;
  final bool isNow;

  const UpcomingClassCard({
    super.key,
    required this.time,
    required this.title,
    required this.instructor,
    required this.classroom,
    this.isNow = false,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isNow ? Colors.blue.shade400 : Colors.grey.shade200, 
          width: isNow ? 1.5 : 1
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Time section
            Container(
              width: 80,
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
              decoration: BoxDecoration(
                color: isNow ? Colors.blue.shade50 : Colors.grey.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                children: [
                  Text(
                    time.contains(' - ') ? time.split(' - ')[0] : time, 
                    style: TextStyle(
                      fontWeight: FontWeight.bold, 
                      fontSize: time.contains(' - ') ? 15 : 12,
                      color: isNow ? Colors.blue.shade700 : Colors.black87
                    )
                  ),
                  if (time.contains(' - ')) ...[
                    const SizedBox(height: 4),
                    Text(
                      time.split(' - ')[1], 
                      style: const TextStyle(fontSize: 12, color: Colors.grey)
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 16),
            // Details section
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (isNow) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text('ŞU AN DEVAM EDİYOR', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.red)),
                    ),
                    const SizedBox(height: 8),
                  ],
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: const Color(0xFF1E293B))),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.person_outline, size: 14, color: Colors.grey.shade600),
                      const SizedBox(width: 4),
                      Expanded(child: Text(instructor, style: TextStyle(fontSize: 12, color: Colors.grey.shade700), overflow: TextOverflow.ellipsis)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.room_outlined, size: 14, color: Colors.grey.shade600),
                      const SizedBox(width: 4),
                      Text(classroom, style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ------------------- QR SCANNER SCREEN -------------------
class QRScannerScreen extends StatefulWidget {
  final String studentId;
  const QRScannerScreen({super.key, required this.studentId});

  @override
  State<StatefulWidget> createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends State<QRScannerScreen> {
  Barcode? result;
  QRViewController? controller;
  final GlobalKey qrKey = GlobalKey(debugLabel: 'QR');
  final TextEditingController _manualQRController = TextEditingController();

  @override
  void reassemble() {
    super.reassemble();
    if (Platform.isAndroid) {
      controller!.pauseCamera();
    }
    controller!.resumeCamera();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Derse Katıl (QR Okut)')),
      body: Column(
        children: <Widget>[
          Expanded(flex: 3, child: _buildQrView(context)),
          Expanded(
            flex: 2,
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    (result != null)
                        ? Text('Sonuç: ${result!.code}\nYoklama Sisteme İşleniyor...')
                        : const Text('Kameralı Cihazınız Yoksa: Aşağıya QR Kod Verisini (Hash) Kopyalayıp Yapıştırın'),
                    const SizedBox(height: 10),
                    const Divider(),
                    const Text('Test: Manuel Bilgisayardan Tarama', style: TextStyle(fontWeight: FontWeight.bold)),
                    TextField(
                      controller: _manualQRController,
                      decoration: const InputDecoration(
                        labelText: 'Web sitesindeki QR kod değerini buraya girin (örnek: QR_DYNAMIC...)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 10),
                    ElevatedButton(
                      onPressed: () {
                        if (_manualQRController.text.isNotEmpty) {
                          verifyAttendance(_manualQRController.text);
                        }
                      },
                      child: const Text('Manuel Olarak Yoklamaya Katıl'),
                    )
                  ],
                ),
              ),
            ),
          )
        ],
      ),
    );
  }

  void _onQRViewCreated(QRViewController controller) {
    this.controller = controller;
    controller.scannedDataStream.listen((scanData) {
      setState(() {
        result = scanData;
      });
      // TODO: send qr_payload to node.js proxy backend here
      verifyAttendance(scanData.code);
    });
  }

  bool _isVerified = false;

  void verifyAttendance(String? payload) async {
    if (_isVerified || payload == null) return;
    _isVerified = true; // Prevent loop
    
    controller?.pauseCamera();

    try {
      String deviceId = await getDeviceId();

      String url = kIsWeb ? 'http://localhost:5000/api/attendance/scan' : 'http://10.0.2.2:5000/api/attendance/scan';
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'student_id': widget.studentId,
          'device_id': deviceId,
          'qr_content': payload,
        }),
      );

      if (response.statusCode == 200) {
        showDialog(context: context, builder: (_) => AlertDialog(
          title: const Text("Başarılı"), 
          content: const Text("Yoklamanız sisteme işlenmiştir."),
          actions: [
            TextButton(onPressed: () {
              Navigator.pop(context); // close dialog
              Navigator.pop(context); // go back to dashboard
            }, child: const Text("Tamam"))
          ],
        ));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Hata: Cihaz Doğrulanamadı veya QR Geçersiz')));
        _isVerified = false;
        controller?.resumeCamera();
      }
    } catch(e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Bağlantı Hatası: $e')));
      _isVerified = false;
      controller?.resumeCamera();
    }
  }

  Widget _buildQrView(BuildContext context) {
    var scanArea = (MediaQuery.of(context).size.width < 400 || MediaQuery.of(context).size.height < 400) ? 250.0 : 300.0;
    return QRView(
      key: qrKey,
      onQRViewCreated: _onQRViewCreated,
      overlay: QrScannerOverlayShape(
          borderColor: Colors.red,
          borderRadius: 10,
          borderLength: 30,
          borderWidth: 10,
          cutOutSize: scanArea),
      onPermissionSet: (ctrl, p) => _onPermissionSet(context, ctrl, p),
    );
  }

  void _onPermissionSet(BuildContext context, QRViewController ctrl, bool p) {
    if (!p) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('no Permission')),
      );
    }
  }

  @override
  void dispose() {
    controller?.dispose();
    super.dispose();
  }
}
