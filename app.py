from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import math
import uuid
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────
#  MATH HELPERS
# ─────────────────────────────────────────

def log_gamma(z):
    """Lanczos approximation for log-gamma."""
    g = 7
    c = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ]
    if z < 0.5:
        return math.log(math.pi / math.sin(math.pi * z)) - log_gamma(1 - z)
    z -= 1
    x = c[0]
    for i in range(1, g + 2):
        x += c[i] / (z + i)
    t = z + g + 0.5
    return 0.5 * math.log(2 * math.pi) + (z + 0.5) * math.log(t) - t + math.log(x)


def gamma_series(a, x):
    eps = 1e-10
    term = 1 / a
    s = term
    for n in range(1, 201):
        term *= x / (a + n)
        s += term
        if abs(term) < eps * abs(s):
            break
    return s * math.exp(-x + a * math.log(x) - log_gamma(a))


def gamma_cf(a, x):
    eps, fpmin = 1e-10, 1e-300
    b = x + 1 - a
    c = 1 / fpmin
    d = 1 / b
    h = d
    for i in range(1, 201):
        an = -i * (i - a)
        b += 2
        d = an * d + b
        if abs(d) < fpmin: d = fpmin
        c = b + an / c
        if abs(c) < fpmin: c = fpmin
        d = 1 / d
        delta = d * c
        h *= delta
        if abs(delta - 1) < eps:
            break
    return h * math.exp(-x + a * math.log(x) - log_gamma(a))


def chi2_pvalue(chi_sq, df):
    """Upper-tail p-value of chi-square distribution."""
    if chi_sq <= 0:
        return 1.0
    a = df / 2
    x = chi_sq / 2
    if x < a + 1:
        return 1.0 - gamma_series(a, x)
    else:
        return gamma_cf(a, x)


# Critical value lookup table
CRITICAL_VALUES = {
    0.10: {1:2.706,2:4.605,3:6.251,4:7.779,5:9.236,6:10.645,7:12.017,8:13.362,9:14.684,10:15.987,
           11:17.275,12:18.549,13:19.812,14:21.064,15:22.307,16:23.542,17:24.769,18:25.989,19:27.204,20:28.412},
    0.05: {1:3.841,2:5.991,3:7.815,4:9.488,5:11.070,6:12.592,7:14.067,8:15.507,9:16.919,10:18.307,
           11:19.675,12:21.026,13:22.362,14:23.685,15:24.996,16:26.296,17:27.587,18:28.869,19:30.144,20:31.410},
    0.01: {1:6.635,2:9.210,3:11.345,4:13.277,5:15.086,6:16.812,7:18.475,8:20.090,9:21.666,10:23.209,
           11:24.725,12:26.217,13:27.688,14:29.141,15:30.578,16:32.000,17:33.409,18:34.805,19:36.191,20:37.566},
}


def get_critical_value(alpha, df):
    table = CRITICAL_VALUES.get(alpha, {})
    if df in table:
        return table[df]
    # Wilson-Hilferty approximation for df > 20
    z_map = {0.10: 1.282, 0.05: 1.645, 0.01: 2.326}
    z = z_map.get(alpha, 1.645)
    h = 2 / (9 * df)
    return df * ((1 - h + z * math.sqrt(h)) ** 3)


# ─────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/calculate/goodness-of-fit", methods=["POST"])
def goodness_of_fit():
    data = request.get_json()

    # ── Validate ──
    observed = data.get("observed", [])
    expected = data.get("expected", [])
    alpha    = data.get("alpha", 0.05)

    if not observed or not expected:
        return jsonify({"error": "Observed and expected values are required"}), 400
    if len(observed) != len(expected):
        return jsonify({"error": "Observed and expected must have the same length"}), 400
    if any(v < 0 for v in observed + expected):
        return jsonify({"error": "Values cannot be negative"}), 400
    if any(e == 0 for e in expected):
        return jsonify({"error": "Expected values cannot be zero"}), 400

    # ── Calculate ──
    steps = []
    chi_sq = 0
    for i, (o, e) in enumerate(zip(observed, expected)):
        diff    = o - e
        diff_sq = diff ** 2
        comp    = diff_sq / e
        chi_sq += comp
        steps.append({
            "label":            f"Category {i+1}",
            "observed":         round(o, 4),
            "expected":         round(e, 4),
            "difference":       round(diff, 4),
            "differenceSquared":round(diff_sq, 4),
            "chiComponent":     round(comp, 6),
        })

    df             = len(observed) - 1
    p_value        = chi2_pvalue(chi_sq, df)
    critical_value = get_critical_value(alpha, df)
    decision       = "reject" if chi_sq > critical_value else "accept"
    alpha_pct      = int(alpha * 100)

    if decision == "reject":
        interpretation = (
            f"At the {alpha_pct}% significance level, we REJECT the null hypothesis. "
            f"There is sufficient evidence that the observed distribution differs "
            f"significantly from the expected distribution "
            f"(χ² = {chi_sq:.4f}, p = {p_value:.4f})."
        )
    else:
        interpretation = (
            f"At the {alpha_pct}% significance level, we FAIL TO REJECT the null hypothesis. "
            f"There is insufficient evidence that the observed distribution differs "
            f"from the expected distribution "
            f"(χ² = {chi_sq:.4f}, p = {p_value:.4f})."
        )

    return jsonify({
        "testType":       "Goodness of Fit",
        "chiSquareValue": round(chi_sq, 6),
        "degreesOfFreedom": df,
        "pValue":         round(p_value, 6),
        "criticalValue":  round(critical_value, 6),
        "alpha":          alpha,
        "decision":       decision,
        "interpretation": interpretation,
        "steps":          steps,
        "observed":       observed,
        "expected":       expected,
    })


@app.route("/calculate/independence", methods=["POST"])
def independence():
    data = request.get_json()

    observed = data.get("observed", [])
    alpha    = data.get("alpha", 0.05)

    if not observed or not observed[0]:
        return jsonify({"error": "Observed table is required"}), 400
    if any(v < 0 for row in observed for v in row):
        return jsonify({"error": "Values cannot be negative"}), 400

    rows = len(observed)
    cols = len(observed[0])

    row_sums = [sum(row) for row in observed]
    col_sums = [sum(observed[r][c] for r in range(rows)) for c in range(cols)]
    total    = sum(row_sums)

    if total == 0:
        return jsonify({"error": "Total of all values cannot be zero"}), 400

    expected = [
        [row_sums[r] * col_sums[c] / total for c in range(cols)]
        for r in range(rows)
    ]

    steps  = []
    chi_sq = 0
    for r in range(rows):
        for c in range(cols):
            o    = observed[r][c]
            e    = expected[r][c]
            if e == 0:
                continue
            diff    = o - e
            diff_sq = diff ** 2
            comp    = diff_sq / e
            chi_sq += comp
            steps.append({
                "label":            f"Row {r+1}, Col {c+1}",
                "observed":         round(o, 4),
                "expected":         round(e, 6),
                "difference":       round(diff, 6),
                "differenceSquared":round(diff_sq, 6),
                "chiComponent":     round(comp, 6),
            })

    df             = (rows - 1) * (cols - 1)
    p_value        = chi2_pvalue(chi_sq, df)
    critical_value = get_critical_value(alpha, df)
    decision       = "reject" if chi_sq > critical_value else "accept"
    alpha_pct      = int(alpha * 100)

    if decision == "reject":
        interpretation = (
            f"At the {alpha_pct}% significance level, we REJECT the null hypothesis of independence. "
            f"There is sufficient evidence that the two variables are associated "
            f"(χ² = {chi_sq:.4f}, p = {p_value:.4f})."
        )
    else:
        interpretation = (
            f"At the {alpha_pct}% significance level, we FAIL TO REJECT the null hypothesis. "
            f"There is insufficient evidence to conclude the two variables are associated "
            f"(χ² = {chi_sq:.4f}, p = {p_value:.4f})."
        )

    return jsonify({
        "testType":         "Test of Independence",
        "chiSquareValue":   round(chi_sq, 6),
        "degreesOfFreedom": df,
        "pValue":           round(p_value, 6),
        "criticalValue":    round(critical_value, 6),
        "alpha":            alpha,
        "decision":         decision,
        "interpretation":   interpretation,
        "steps":            steps,
        "observed":         observed,
        "expected":         expected,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
