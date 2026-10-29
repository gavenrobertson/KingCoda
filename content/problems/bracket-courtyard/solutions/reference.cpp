class Solution {
public:
    int firstBadGate(string& plan) {
        string open;
        for (int i = 0; i < (int)plan.size(); i++) {
            char c = plan[i];
            if (c == '(' || c == '[' || c == '{') {
                open.push_back(c);
                continue;
            }
            char want = c == ')' ? '(' : c == ']' ? '[' : '{';
            if (open.empty() || open.back() != want) return i;
            open.pop_back();
        }
        return open.empty() ? -1 : (int)plan.size();
    }
};
