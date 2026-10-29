class Solution {
public:
    bool isEcho(string& decree) {
        int i = 0, j = (int)decree.size() - 1;
        while (i < j) {
            if (!isalnum((unsigned char)decree[i])) { i++; continue; }
            if (!isalnum((unsigned char)decree[j])) { j--; continue; }
            if (tolower((unsigned char)decree[i]) != tolower((unsigned char)decree[j])) return false;
            i++;
            j--;
        }
        return true;
    }
};
