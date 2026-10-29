/**
 * kc_prelude.hpp: included before user code in every C++ submission. Provides the usual headers,
 * ListNode/TreeNode, and a small JSON reader/writer for the types in problem-schema.
 */
export const CPP_PRELUDE = String.raw`#pragma once
#include <bits/stdc++.h>
using namespace std;

struct ListNode {
  int val;
  ListNode *next;
  ListNode() : val(0), next(nullptr) {}
  ListNode(int x) : val(x), next(nullptr) {}
  ListNode(int x, ListNode *next) : val(x), next(next) {}
};

struct TreeNode {
  int val;
  TreeNode *left;
  TreeNode *right;
  TreeNode() : val(0), left(nullptr), right(nullptr) {}
  TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
  TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};

namespace kc {

struct Json {
  enum Kind { Null, Bool, Num, Str, Arr } kind = Null;
  bool b = false;
  double num = 0;
  long long integer = 0;
  bool isInt = false;
  string s;
  vector<Json> a;
};

struct Parser {
  const string &t;
  size_t i = 0;
  explicit Parser(const string &text) : t(text) {}
  [[noreturn]] void fail(const char *why) { throw runtime_error(string("kc: bad test input: ") + why); }
  void ws() { while (i < t.size() && isspace((unsigned char)t[i])) i++; }
  Json value() {
    ws();
    if (i >= t.size()) fail("unexpected end");
    char c = t[i];
    Json j;
    if (c == '[') {
      j.kind = Json::Arr;
      i++;
      ws();
      if (i < t.size() && t[i] == ']') { i++; return j; }
      while (true) {
        j.a.push_back(value());
        ws();
        if (i < t.size() && t[i] == ',') { i++; continue; }
        if (i < t.size() && t[i] == ']') { i++; return j; }
        fail("expected , or ]");
      }
    }
    if (c == '"') { j.kind = Json::Str; j.s = str(); return j; }
    if (t.compare(i, 4, "true") == 0) { i += 4; j.kind = Json::Bool; j.b = true; return j; }
    if (t.compare(i, 5, "false") == 0) { i += 5; j.kind = Json::Bool; return j; }
    if (t.compare(i, 4, "null") == 0) { i += 4; return j; }
    size_t start = i;
    if (t[i] == '-') i++;
    while (i < t.size() && (isdigit((unsigned char)t[i]) || t[i] == '.' || t[i] == 'e' || t[i] == 'E' || t[i] == '+' || t[i] == '-')) i++;
    string num = t.substr(start, i - start);
    if (num.empty() || num == "-") fail("bad number");
    j.kind = Json::Num;
    j.num = strtod(num.c_str(), nullptr);
    if (num.find_first_of(".eE") == string::npos) { j.isInt = true; j.integer = strtoll(num.c_str(), nullptr, 10); }
    return j;
  }
  string str() {
    string out;
    i++;  // opening quote
    while (i < t.size() && t[i] != '"') {
      char c = t[i++];
      if (c != '\\') { out += c; continue; }
      if (i >= t.size()) fail("bad escape");
      char e = t[i++];
      switch (e) {
        case 'n': out += '\n'; break;
        case 't': out += '\t'; break;
        case 'r': out += '\r'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 'u': {
          unsigned cp = stoul(t.substr(i, 4), nullptr, 16);
          i += 4;
          if (cp < 0x80) out += (char)cp;
          else if (cp < 0x800) { out += (char)(0xC0 | (cp >> 6)); out += (char)(0x80 | (cp & 0x3F)); }
          else { out += (char)(0xE0 | (cp >> 12)); out += (char)(0x80 | ((cp >> 6) & 0x3F)); out += (char)(0x80 | (cp & 0x3F)); }
          break;
        }
        default: out += e;
      }
    }
    if (i >= t.size()) fail("unterminated string");
    i++;  // closing quote
    return out;
  }
};

inline Json parse(const string &text) { Parser p(text); return p.value(); }

template <class T> struct Codec;

template <> struct Codec<int> {
  static int from(const Json &j) { return (int)j.integer; }
  static void to(string &o, int v) { o += to_string(v); }
};
template <> struct Codec<long long> {
  static long long from(const Json &j) { return j.integer; }
  static void to(string &o, long long v) { o += to_string(v); }
};
template <> struct Codec<double> {
  static double from(const Json &j) { return j.isInt ? (double)j.integer : j.num; }
  static void to(string &o, double v) {
    if (!isfinite(v)) { o += "null"; return; }
    char buf[32];
    snprintf(buf, sizeof buf, "%.17g", v);
    o += buf;
  }
};
template <> struct Codec<bool> {
  static bool from(const Json &j) { return j.b; }
  static void to(string &o, bool v) { o += v ? "true" : "false"; }
};
template <> struct Codec<string> {
  static string from(const Json &j) { return j.s; }
  static void to(string &o, const string &v) {
    o += '"';
    for (unsigned char c : v) {
      if (c == '"') o += "\\\"";
      else if (c == '\\') o += "\\\\";
      else if (c == '\n') o += "\\n";
      else if (c == '\t') o += "\\t";
      else if (c == '\r') o += "\\r";
      else if (c < 0x20) { char buf[8]; snprintf(buf, sizeof buf, "\\u%04x", c); o += buf; }
      else o += (char)c;
    }
    o += '"';
  }
};
template <class T> struct Codec<vector<T>> {
  static vector<T> from(const Json &j) {
    vector<T> v;
    v.reserve(j.a.size());
    for (auto &x : j.a) v.push_back(Codec<T>::from(x));
    return v;
  }
  static void to(string &o, const vector<T> &v) {
    o += '[';
    for (size_t i = 0; i < v.size(); i++) {
      if (i) o += ',';
      Codec<T>::to(o, v[i]);
    }
    o += ']';
  }
};
// vector<bool> is a bitset, so it needs its own specialisation.
template <> struct Codec<vector<bool>> {
  static vector<bool> from(const Json &j) {
    vector<bool> v;
    for (auto &x : j.a) v.push_back(x.b);
    return v;
  }
  static void to(string &o, const vector<bool> &v) {
    o += '[';
    for (size_t i = 0; i < v.size(); i++) { if (i) o += ','; o += v[i] ? "true" : "false"; }
    o += ']';
  }
};
template <> struct Codec<ListNode *> {
  static ListNode *from(const Json &j) {
    ListNode dummy;
    ListNode *tail = &dummy;
    for (auto &x : j.a) { tail->next = new ListNode((int)x.integer); tail = tail->next; }
    return dummy.next;
  }
  static void to(string &o, ListNode *head) {
    o += '[';
    // Cap the walk so a cycle in user output can't loop forever.
    for (size_t n = 0; head && n < 2000000; head = head->next, n++) {
      if (n) o += ',';
      o += to_string(head->val);
    }
    o += ']';
  }
};
template <> struct Codec<TreeNode *> {
  static TreeNode *from(const Json &j) {
    if (j.a.empty() || j.a[0].kind == Json::Null) return nullptr;
    TreeNode *root = new TreeNode((int)j.a[0].integer);
    queue<TreeNode *> q;
    q.push(root);
    size_t i = 1;
    while (!q.empty() && i < j.a.size()) {
      TreeNode *n = q.front();
      q.pop();
      if (i < j.a.size() && j.a[i].kind != Json::Null) { n->left = new TreeNode((int)j.a[i].integer); q.push(n->left); }
      i++;
      if (i < j.a.size() && j.a[i].kind != Json::Null) { n->right = new TreeNode((int)j.a[i].integer); q.push(n->right); }
      i++;
    }
    return root;
  }
  static void to(string &o, TreeNode *root) {
    vector<string> parts;
    queue<TreeNode *> q;
    if (root) q.push(root);
    size_t guard = 0;
    while (!q.empty() && guard++ < 4000000) {
      TreeNode *n = q.front();
      q.pop();
      if (!n) { parts.push_back("null"); continue; }
      parts.push_back(to_string(n->val));
      q.push(n->left);
      q.push(n->right);
    }
    while (!parts.empty() && parts.back() == "null") parts.pop_back();
    o += '[';
    for (size_t i = 0; i < parts.size(); i++) { if (i) o += ','; o += parts[i]; }
    o += ']';
  }
};

template <class T> T from_json(const Json &j) { return Codec<T>::from(j); }
template <class T> void emit(const T &v) {
  string o = "\x1e";
  Codec<T>::to(o, v);
  o += '\n';
  fwrite(o.data(), 1, o.size(), stdout);
  fflush(stdout);
}

}  // namespace kc
`;
